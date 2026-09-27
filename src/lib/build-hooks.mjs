// Astro integration that finishes and checks every build (astro:build:done):
//
//  1. Publishes install/install.sh as dist/install, after checking it.
//  2. Writes dist/_headers and dist/robots.txt for Cloudflare Workers.
//  3. Checks the output matches the build mode (see verifyOutput). A
//     production build also fails on placeholder copy and illustrative
//     examples, naming each one. Every build checks the share image and the
//     size of every image it serves.
//
// Any failed check throws, which fails the build.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_URL } from "../../site.config.mjs";
import { SHARE_IMAGE_URL } from "./share-image.mjs";

const INSTALL_SCRIPT = fileURLToPath(new URL("../../install/install.sh", import.meta.url));

// The Worker's name in wrangler.jsonc. Production is also served at
// https://delocal-site.<account subdomain>.workers.dev.
const WORKER_NAME = "delocal-site";

// The share image, public/og.png (see art/README.md), and every other image
// the site serves, such as the landing page's closing art in /_astro/.
const SHARE_IMAGE = { file: "og.png", width: 1200, height: 630, maxBytes: 300 * 1024 };
const MAX_IMAGE_BYTES = 150 * 1024;
const IMAGE_FILE = /\.(avif|webp|png|jpe?g|gif)$/i;

export default function buildHooks({ siteMode, siteEnv }) {
  return {
    name: "delocal:build-hooks",
    hooks: {
      "astro:build:done": async ({ dir, pages, logger }) => {
        const outDir = fileURLToPath(dir);
        checkNothingShadowsInstall(outDir, pages);
        await publishInstallScript(outDir);
        await writeFile(path.join(outDir, "_headers"), headersFile(siteEnv));
        await writeFile(path.join(outDir, "robots.txt"), robotsFile(siteEnv));
        await verifyOutput(outDir, siteMode, siteEnv);
        logger.info(`verified ${siteMode} build (SITE_ENV=${siteEnv})`);
      },
    },
  };
}

// /install is served from a file with no extension, so no page may claim it:
// not a page route, an endpoint, a redirect or a file copied from public/.
function checkNothingShadowsInstall(outDir, pages) {
  const routed = pages
    .map((page) => page.pathname.replace(/^\/+|\/+$/g, ""))
    .filter((pathname) => pathname === "install" || pathname.startsWith("install/"));
  if (routed.length > 0) {
    throw new Error(`these routes shadow /install: ${routed.map((p) => `/${p}`).join(", ")}`);
  }
  for (const name of ["install", "install.html"]) {
    if (existsSync(path.join(outDir, name))) {
      throw new Error(`${name} already exists in the build output and would shadow /install (is it in public/?)`);
    }
  }
}

async function publishInstallScript(outDir) {
  const script = await readFile(INSTALL_SCRIPT, "utf8");
  if (!script.startsWith("#!/bin/sh")) {
    throw new Error("install/install.sh must start with #!/bin/sh");
  }
  if (/<(!doctype|html|head|body)[\s>]/i.test(script)) {
    throw new Error("install/install.sh contains HTML");
  }
  const syntax = spawnSync("sh", ["-n", INSTALL_SCRIPT], { encoding: "utf8" });
  if (syntax.error) throw syntax.error;
  if (syntax.status !== 0) {
    throw new Error(`sh -n install/install.sh failed:\n${syntax.stderr}`);
  }
  await copyFile(INSTALL_SCRIPT, path.join(outDir, "install"));
}

// Workers applies every _headers rule that matches a path and joins the
// values, so a header must never be set by two rules whose paths overlap.
// "/*" overlaps everything: nothing it sets may appear in another rule.
// checkHeaderRules enforces this on the generated file.
function headersFile(siteEnv) {
  const everywhere = [
    "X-Content-Type-Options: nosniff",
    "Referrer-Policy: strict-origin-when-cross-origin",
    "X-Frame-Options: DENY",
    "Permissions-Policy: camera=(), microphone=(), geolocation=()",
    // No includeSubDomains or preload: subdomains may come later, and preload
    // is hard to undo.
    "Strict-Transport-Security: max-age=31536000",
  ];
  if (siteEnv === "preview") everywhere.push("X-Robots-Tag: noindex, nofollow");

  const rules = [
    ["/*", everywhere],
    // Production only (a preview build sets X-Robots-Tag in "/*" instead):
    // the workers.dev copy of production must never be indexed. A host
    // placeholder matches exactly one DNS label, so this matches neither
    // delocal.sh nor the version and preview hosts, which are
    // <version or alias>-delocal-site.<subdomain>.workers.dev.
    ...(siteEnv === "production"
      ? [[`https://${WORKER_NAME}.:subdomain.workers.dev/*`, ["X-Robots-Tag: noindex, nofollow"]]]
      : []),
    [
      "/install",
      [
        "Content-Type: text/plain; charset=utf-8",
        "Cache-Control: public, max-age=300",
        "Content-Disposition: inline",
      ],
    ],
    ["/_astro/*", ["Cache-Control: public, max-age=31536000, immutable"]],
  ];
  const body = rules.map(([pattern, headers]) => [pattern, ...headers.map((h) => `  ${h}`)].join("\n"));
  return `# Generated by src/lib/build-hooks.mjs. Do not edit.\n${body.join("\n\n")}\n`;
}

// Parses a generated _headers file and returns a problem for each header that
// some request would get twice: set twice in one rule, or set in two rules
// whose URL patterns overlap.
function checkHeaderRules(text) {
  const rules = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      rules.push({ source: line, ...parsePattern(line), headers: [] });
    } else if (rules.length > 0 && /^\s+[A-Za-z0-9-]+:/.test(line)) {
      rules.at(-1).headers.push(line.trim().split(":")[0].toLowerCase());
    } else {
      throw new Error(`_headers: unexpected line: ${line}`);
    }
  }

  const problems = [];
  for (const rule of rules) {
    const repeated = rule.headers.filter((name, i) => rule.headers.indexOf(name) !== i);
    if (repeated.length > 0) problems.push(`_headers rule ${rule.source} sets ${repeated.join(", ")} more than once`);
  }
  for (const [i, a] of rules.entries()) {
    for (const b of rules.slice(i + 1)) {
      const shared = a.headers.filter((name) => b.headers.includes(name));
      if (shared.length > 0 && patternsOverlap(a, b)) {
        problems.push(`_headers rules ${a.source} and ${b.source} overlap and both set ${shared.join(", ")}`);
      }
    }
  }
  return problems;
}

// Splits a rule's URL pattern into host labels (null for any host), a literal
// path prefix and whether it ends in a splat. Only the shapes headersFile
// writes are supported, so that patternsOverlap stays exact: host labels that
// are literal or a whole-label placeholder, and a literal path with an
// optional trailing splat. Anything else throws.
function parsePattern(pattern) {
  const match = /^(?:https:\/\/([^/]+))?(\/[^*:]*)(\*?)$/.exec(pattern);
  const labels = match?.[1]?.split(".") ?? null;
  const labelOk = (label) => /^(?:[a-z0-9-]+|:[A-Za-z]\w*)$/.test(label);
  if (!match || (labels && !labels.every(labelOk))) {
    throw new Error(`_headers: unsupported URL pattern ${pattern}`);
  }
  return { labels, prefix: match[2], splat: match[3] === "*" };
}

// Whether some request URL matches both patterns (from parsePattern).
function patternsOverlap(a, b) {
  const hosts =
    a.labels === null ||
    b.labels === null ||
    (a.labels.length === b.labels.length &&
      a.labels.every((label, i) => label.startsWith(":") || b.labels[i].startsWith(":") || label === b.labels[i]));
  let paths;
  if (a.splat && b.splat) paths = a.prefix.startsWith(b.prefix) || b.prefix.startsWith(a.prefix);
  else if (a.splat) paths = b.prefix.startsWith(a.prefix);
  else if (b.splat) paths = a.prefix.startsWith(b.prefix);
  else paths = a.prefix === b.prefix;
  return hosts && paths;
}

function robotsFile(siteEnv) {
  return `User-agent: *\n${siteEnv === "preview" ? "Disallow: /" : "Allow: /"}\n`;
}

async function verifyOutput(outDir, siteMode, siteEnv) {
  const files = await listFiles(outDir);
  const pages = files.filter((file) => file.endsWith(".html"));
  const problems = [];

  if (siteMode === "holding") {
    const extra = pages.filter((page) => page !== "index.html" && page !== "404.html");
    if (extra.length > 0) problems.push(`holding build has pages besides index.html and 404.html: ${extra.join(", ")}`);
    for (const page of ["index.html", "404.html"]) {
      if (!pages.includes(page)) problems.push(`holding build is missing ${page}`);
    }
    if (existsSync(path.join(outDir, "pagefind"))) problems.push("holding build has a pagefind directory");
  } else if (!pages.includes("docs/index.html")) {
    problems.push("full build is missing docs/index.html");
  }

  problems.push(...(await checkShareImage(outDir, files)));
  for (const file of files.filter((f) => IMAGE_FILE.test(f) && f !== SHARE_IMAGE.file)) {
    const { size } = await stat(path.join(outDir, file));
    if (size > MAX_IMAGE_BYTES) problems.push(`${file} is ${kb(size)}, over the ${kb(MAX_IMAGE_BYTES)} limit for images`);
  }

  for (const file of files.filter((f) => f.endsWith(".html") || f.endsWith(".css"))) {
    const text = await readFile(path.join(outDir, file), "utf8");
    for (const url of externalResources(text)) problems.push(`${file} loads ${url} from another host`);
    if (!file.endsWith(".html")) continue;
    problems.push(...checkIndexing(file, text));
    problems.push(...checkShareMeta(file, text));
    problems.push(...checkOrbitArtIds(file, text));
    if (siteEnv === "production") {
      for (const name of placeholders(text)) problems.push(`${file} has placeholder copy: ${name}`);
      for (const name of illustrations(text)) problems.push(`${file} has an illustrative example: ${name}`);
    }
  }

  problems.push(...checkHeaderRules(await readFile(path.join(outDir, "_headers"), "utf8")));

  if (problems.length > 0) {
    throw new Error(`build output check failed:\n  - ${problems.join("\n  - ")}`);
  }
}

// Paths relative to outDir, with forward slashes.
async function listFiles(outDir) {
  const entries = await readdir(outDir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(outDir, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"))
    .sort();
}

// Every page has exactly one canonical link, to its address on SITE_URL, and
// is not noindex. The exception is 404.html: it is served at every unknown
// path, and at /404 with status 200, so it is noindex and has no canonical.
function checkIndexing(file, html) {
  const canonicals = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map(([tag]) => tag)
    .filter((tag) => /\srel\s*=\s*["']?canonical\b/i.test(tag))
    .map((tag) => {
      const href = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(tag);
      return href ? (href[1] ?? href[2] ?? href[3]) : "(no href)";
    });
  const noindex = /<meta\b(?=[^>]*\sname\s*=\s*["']?robots\b)(?=[^>]*\scontent\s*=\s*["'][^"']*\bnoindex\b)[^>]*>/i.test(html);

  const problems = [];
  if (file === "404.html") {
    if (canonicals.length > 0) problems.push(`404.html has a canonical link, ${canonicals.join(", ")}`);
    if (!noindex) problems.push("404.html has no robots noindex meta tag");
    return problems;
  }
  const expected = new URL(`/${file.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "")}`, SITE_URL).href;
  if (canonicals.length !== 1 || canonicals[0] !== expected) {
    problems.push(`${file} has canonical ${canonicals.join(", ") || "none"}, expected exactly one: ${expected}`);
  }
  if (noindex) problems.push(`${file} has a robots noindex meta tag`);
  return problems;
}

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

// og.png is a PNG of the right size, and small enough.
async function checkShareImage(outDir, files) {
  const { file, width, height, maxBytes } = SHARE_IMAGE;
  if (!files.includes(file)) return [`the build has no ${file} (it comes from public/)`];
  const data = await readFile(path.join(outDir, file));
  const problems = [];
  if (!data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return [`${file} is not a PNG`];
  }
  const size = [data.readUInt32BE(16), data.readUInt32BE(20)];
  if (size[0] !== width || size[1] !== height) problems.push(`${file} is ${size.join("x")}, expected ${width}x${height}`);
  if (data.length > maxBytes) problems.push(`${file} is ${kb(data.length)}, over the ${kb(maxBytes)} limit`);
  return problems;
}

// Every page has exactly one og:image, the share image's absolute URL.
function checkShareMeta(file, html) {
  const images = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map(([tag]) => tag)
    .filter((tag) => /\sproperty\s*=\s*["']?og:image["'\s>/]/i.test(tag))
    .map((tag) => /\scontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag)?.slice(1).find((v) => v !== undefined) ?? "(no content)");
  if (images.length === 1 && images[0] === SHARE_IMAGE_URL) return [];
  return [`${file} has og:image ${images.join(", ") || "none"}, expected exactly one: ${SHARE_IMAGE_URL}`];
}

// Names each placeholder a page still has: <p class="ph">[Placeholder: ...]</p>,
// or either half of it. That is every "[Placeholder ...]" text, including in
// attributes such as the meta description, and every element with class "ph"
// whose text is not one.
function placeholders(html) {
  const names = [...html.matchAll(/\[Placeholder[^\]]*\]/g)].map(([text]) => text);
  for (const match of html.matchAll(/<[a-z][^\s>]*\s[^>]*?\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))[^>]*>([^<]*)/gi)) {
    const value = match[1] ?? match[2] ?? match[3];
    if (value.split(/\s+/).includes("ph") && !match[4].trim().startsWith("[Placeholder")) {
      names.push(`an element with class "ph" and no "[Placeholder" text: ${match[0].trim().slice(0, 120)}`);
    }
  }
  return countDuplicates(names.map(decodeEntities));
}

// Names each element marked data-illustrative (the terminal examples in
// Terminal.astro), by its aria-label.
function illustrations(html) {
  const names = [...html.matchAll(/<[a-z][^>]*\sdata-illustrative\b[^>]*>/gi)].map(([tag]) => {
    const label = /\saria-label\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    return label ? `"${decodeEntities(label[1] ?? label[2])}"` : tag.slice(0, 120);
  });
  return countDuplicates(names);
}

// Each OrbitArt on a page needs its own id, or their gradient ids clash.
function checkOrbitArtIds(file, html) {
  const ids = [...html.matchAll(/\sdata-orbit-art\s*=\s*"([^"]*)"/g)].map((match) => match[1]);
  const repeated = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  return repeated.map((id) => `${file} has more than one OrbitArt with id "${id}"`);
}

// ["a", "b", "a"] -> ["a (2 times)", "b"]
function countDuplicates(names) {
  const counts = new Map();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, n]) => (n > 1 ? `${name} (${n} times)` : name));
}

function decodeEntities(text) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  return text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(\w+));/gi, (entity, dec, hex, name) =>
    dec ? String.fromCodePoint(Number(dec)) : hex ? String.fromCodePoint(parseInt(hex, 16)) : (named[name] ?? entity),
  );
}

// Everything is self-hosted: nothing may load a script, stylesheet, font or
// image from another host. Links (<a href>, canonical and so on) are fine.
const FETCHING_LINK_RELS = /\brel\s*=\s*["']?[^"'>]*\b(stylesheet|preload|modulepreload|prefetch|preconnect|dns-prefetch|icon|apple-touch-icon|manifest)\b/i;
const OTHER_HOST = /^\s*(?:[a-z][a-z0-9+.-]*:)?\/\//i;

function externalResources(text) {
  const urls = [];
  for (const [tag] of text.matchAll(/<(?:script|img|source|video|audio|iframe|embed|link|image|use)\b[^>]*>/gi)) {
    const isLink = /^<link\b/i.test(tag);
    if (isLink && !FETCHING_LINK_RELS.test(tag)) continue;
    for (const match of tag.matchAll(/\s(src|href|xlink:href|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi)) {
      const value = match[2] ?? match[3] ?? match[4];
      const candidates = match[1].toLowerCase() === "srcset" ? value.split(",").map((s) => s.trim().split(/\s+/)[0]) : [value];
      urls.push(...candidates.filter((url) => OTHER_HOST.test(url)));
    }
  }
  for (const match of text.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)|@import\s+(['"])([^'"]*)\3/gi)) {
    const url = match[2] ?? match[4];
    if (OTHER_HOST.test(url)) urls.push(url);
  }
  return urls;
}
