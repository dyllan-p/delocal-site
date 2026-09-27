// Writes art/candidates/index.html, the contact sheet for choosing art. It
// shows what compose-art.mjs made with --out art/candidates/composed-<name>,
// then every candidate, newest round first, each on its real background at
// its real size. Candidates are cropped the way the final version will be:
//
//   closing  in the landing page's closing panel (--raised), at 528x264 as at
//            1440px wide, and at 282x141 as at 390px wide. A CSS mask fades
//            the edges, standing in for the feathering compose-art.mjs does;
//   share    at 1200x630 on --bg, with the mark and wordmark roughly placed
//            in CSS and a guide at 45% of the width.
//
// generate-art.mjs runs this after each run. To rebuild it by hand:
//
//   node scripts/contact-sheet.mjs
import { existsSync } from "node:fs";
import { copyFile, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CANDIDATES = path.join(ROOT, "art/candidates");
// Copied next to the sheet: browsers won't load a font from a parent
// directory of a file:// page.
const FONT = path.join(ROOT, "node_modules/@fontsource-variable/martian-mono/files/martian-mono-latin-standard-normal.woff2");

// What each round tried. A round with no entry here is shown by number only.
const ROUNDS = {
  1: "Soft abstract glows, with and without line-drawn machines. gemini-3.1-flash-image.",
  2: "1980s computer-magazine illustration with a print texture: a mascot (E) or a desk scene (F). gemini-3-pro-image.",
  3: "Refinements of the picks, closing-f-01 and share-f-02, each sent with the other as a second reference so they read as the same desk. gemini-3-pro-image at 2K.",
};

const escape = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function caption(record) {
  const details = [
    record.model,
    `${record.image_size}, ${record.aspect_ratio}${record.width ? `, ${record.width}x${record.height}` : ""}`,
    `prompt ${record.prompt_file}`,
    ...(record.refs ?? []).map((ref, i) => `ref ${i + 1} ${ref}`),
    record.date.slice(0, 10),
  ];
  return `<p class="caption"><a href="${escape(record.file)}">${escape(record.file)}</a> · ${details.map(escape).join(" · ")}</p>`;
}

const mark = `<svg class="mark" viewBox="0 0 44 16" aria-hidden="true"><circle cx="4.5" cy="8" r="4.5" fill="#5fd4e6"/><circle cx="22" cy="8" r="5.5" fill="#f5b947"/><circle cx="39.5" cy="8" r="4.5" fill="#b39bff"/></svg>`;

// A composed image is shown as it is: no mask, and no CSS mark or wordmark.
function closingPanels(file, composed) {
  const text = `<div class="panel-text"><div class="ph ph-h2"></div><div class="ph ph-two"></div><span class="button">Watch on GitHub</span></div>`;
  const img = (w, h) => `<img class="closing-art${composed ? "" : " masked"}" src="${escape(file)}" alt="" width="${w}" height="${h}">`;
  return `<div class="page-1440"><div class="panel">${text}${img(528, 264)}</div></div>
  <p class="note">At 390px wide:</p>
  <div class="page-390"><div class="panel">${text}${img(282, 141)}</div></div>`;
}

function sharePanel(file, composed) {
  const brand = composed ? "" : `<div class="brand">${mark}<span class="wordmark">delocal</span></div>`;
  return `<div class="share"><img src="${escape(file)}" alt="" width="1200" height="630">${brand}<div class="guide"></div></div>`;
}

const closing = (record) => `<figure>
  ${caption(record)}
  ${closingPanels(record.file, false)}
</figure>`;

const share = (record) => `<figure>
  ${caption(record)}
  ${sharePanel(record.file, false)}
</figure>`;

async function composedSections() {
  const dirs = (await readdir(CANDIDATES, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("composed-") && existsSync(path.join(CANDIDATES, entry.name, "compose.json")))
    .map((entry) => entry.name)
    .sort();
  if (dirs.length === 0) return "";
  const parts = await Promise.all(
    dirs.map(async (dir) => {
      const record = JSON.parse(await readFile(path.join(CANDIDATES, dir, "compose.json"), "utf8"));
      const from = (r) => escape(path.basename(r.source));
      return `<section>
<h3>${escape(dir)}</h3>
<p class="intro">Closing art from ${from(record.closing)}, cropped to its artwork (${record.closing.art_box.width}x${record.closing.art_box.height} in the source). Share image from ${from(record.share)}, scaled into ${record.share.placed.width}x${record.share.placed.height} at x ${record.share.placed.left}, ${Math.round(record.share.bytes / 1024)} KB${record.share.quantised ? " as a palette PNG" : ""}.</p>
<figure><p class="caption"><a href="${escape(dir)}/closing.png">${escape(dir)}/closing.png</a></p>${closingPanels(`${dir}/closing.png`, true)}</figure>
<figure><p class="caption"><a href="${escape(dir)}/share.png">${escape(dir)}/share.png</a> · the dashed guide at 45% is not in the image</p>${sharePanel(`${dir}/share.png`, true)}</figure>
</section>`;
    }),
  );
  return `<h2>Composed</h2>
<p class="intro">What scripts/compose-art.mjs makes: the source remapped so its background is exactly the token colour, cropped or scaled, and feathered at the edges, with the mark and wordmark composited as vector outlines on the share image.</p>
${parts.join("\n")}`;
}

export async function writeContactSheet() {
  const files = (await readdir(CANDIDATES)).filter((file) => file.endsWith(".json")).sort();
  const records = await Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(CANDIDATES, file), "utf8"))));
  await copyFile(FONT, path.join(CANDIDATES, "martian-mono.woff2"));

  const section = (round, piece, title, intro, render) => {
    const shown = records.filter((record) => record.round === round && record.piece === piece);
    if (shown.length === 0) return "";
    return `<section>
<h3>${title} <span>(${shown.length})</span></h3>
<p class="intro">${intro}</p>
${shown.map(render).join("\n")}
</section>`;
  };
  const rounds = [...new Set(records.map((record) => record.round))].sort((a, b) => b - a);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>delocal art candidates</title>
<style>
  @font-face {
    font-family: "Martian Mono Variable";
    font-weight: 100 800;
    font-stretch: 75% 112.5%;
    src: url(martian-mono.woff2) format("woff2-variations");
  }
  :root { color-scheme: dark; }
  body { margin: 0; padding: 48px; background: #14152a; color: #c3c4dc; font: 15px/1.5 system-ui, sans-serif; }
  h1, h2, h3 { color: #eceaf4; font-weight: 500; }
  h2 { margin: 96px 0 0; padding-top: 24px; border-top: 1px solid #3a3c62; font-size: 28px; }
  h3 { margin-top: 56px; }
  h3 span, .note, .caption { color: #8d8fb0; }
  .intro { max-width: 900px; }
  figure { margin: 48px 0 0; }
  .caption { margin: 0 0 12px; font: 13px/1.5 ui-monospace, monospace; }
  .caption a { color: #eceaf4; }
  .note { margin: 20px 0 8px; font-size: 13px; }

  /* The closing band: a --raised panel on --bg, as in Landing.astro. */
  .page-1440 { width: 1248px; }
  .page-390 { width: 338px; }
  .panel { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; padding: 72px; border-radius: 28px; background: #1d1f3d; }
  .page-390 .panel { grid-template-columns: 1fr; padding: 28px; }
  .panel-text { display: grid; gap: 24px; justify-items: start; }
  .ph { width: 100%; border: 1px dashed #3a3c62; border-radius: 16px; box-sizing: border-box; }
  .ph-h2 { height: 70px; }
  .ph-two { height: 58px; }
  .button { display: inline-flex; align-items: center; height: 48px; padding: 0 20px; border-radius: 10px; background: #f5b947; color: #14152a; font: 500 15px ui-monospace, monospace; }
  .closing-art { display: block; object-fit: cover; }
  .closing-art.masked {
    mask-image: linear-gradient(to right, transparent, #000 12%, #000 88%, transparent),
      linear-gradient(to bottom, transparent, #000 16%, #000 84%, transparent);
    mask-composite: intersect;
  }

  /* The share image at 1200x630 on --bg. */
  .share { position: relative; width: 1200px; height: 630px; outline: 1px solid #2a2c4a; overflow: hidden; }
  .share img { display: block; object-fit: cover; }
  .brand { position: absolute; left: 80px; top: 50%; display: flex; align-items: center; gap: 20px; transform: translateY(-50%); }
  .mark { width: 57px; height: 20.73px; margin-top: 0.12em; }
  .wordmark { color: #eceaf4; font: 400 64px/1 "Martian Mono Variable", monospace; font-stretch: 112.5%; letter-spacing: -0.02em; }
  .guide { position: absolute; top: 0; bottom: 0; left: 540px; border-left: 1px dashed rgb(236 234 244 / 0.35); }
</style>
</head>
<body>
<h1>delocal art candidates</h1>
${await composedSections()}
<h2>Candidates</h2>
<p class="intro">Each image is cropped from the centre. The composed version also has its edges feathered into the exact background colour; here a CSS mask on the closing art stands in for that. Click a filename for the raw image from the model.</p>
${rounds
  .map(
    (round) => `<h2>Round ${round}</h2>
<p class="intro">${escape(ROUNDS[round] ?? "")}</p>
${section(
  round,
  "closing",
  "Closing band art",
  "In the landing page's closing panel (--raised #1d1f3d), at the size it shows at 1440px wide and at 390px wide. Decorative, alt=\"\".",
  closing,
)}
${section(
  round,
  "share",
  "Share image",
  "At 1200x630 on --bg #14152a. The mark and wordmark are placed roughly in CSS here; the real ones are composited as vector outlines. The dashed line marks 45% of the width, the part that should stay calm.",
  share,
)}`,
  )
  .join("\n")}
</body>
</html>
`;
  await writeFile(path.join(CANDIDATES, "index.html"), html);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await writeContactSheet();
  console.log("wrote art/candidates/index.html");
}
