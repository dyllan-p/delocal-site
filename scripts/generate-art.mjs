// Generates art candidates with the Gemini API. art/README.md describes the
// whole process.
//
// Usage: node scripts/generate-art.mjs <prompt.md> <count> [--ref <image>]...
//
//   <prompt.md>    a file in art/prompts/. Its frontmatter sets the piece
//                  (closing or share), the round it belongs to on the
//                  contact sheet, the model, the aspect ratio and the size.
//                  The rest of the file is the prompt, sent exactly.
//   <count>        how many images to make, one request each.
//   --ref <image>  also send this image with the prompt, to refine a
//                  candidate. Repeat it to send more than one; they are
//                  sent in the order given, after the prompt.
//
// Each image goes to art/candidates/<prompt name>-<nn>.png, with a .json
// record of how it was made: the model, the exact prompt, the date and the
// reference images, if any. Then the contact sheet, art/candidates/index.html,
// is rebuilt. Both are gitignored.
//
// Budget: 40 images in all, counted in art/.tally.json (also gitignored). A
// run that would go past it is refused. A request that ends without an answer,
// such as a timeout, may still have made an image, so it counts as one.
//
// GEMINI_API_KEY is read from the environment and only ever sent in the
// x-goog-api-key header. Nothing prints it or writes it anywhere.
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeContactSheet } from "./contact-sheet.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CANDIDATES = path.join(ROOT, "art/candidates");
const TALLY = path.join(ROOT, "art/.tally.json");
const BUDGET = 40;

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const TIMEOUT_MS = 5 * 60 * 1000;

// Estimated prices in US dollars, paid tier, from
// https://ai.google.dev/gemini-api/docs/pricing on 2026-09-27: a price per
// output image by size, and per token for input and for text and thinking
// output.
const MODELS = {
  "gemini-3.1-flash-image": { image: { "1K": 0.067, "2K": 0.101, "4K": 0.151 }, input: 0.5e-6, text: 3e-6 },
  "gemini-3-pro-image": { image: { "1K": 0.134, "2K": 0.134, "4K": 0.24 }, input: 2e-6, text: 12e-6 },
};
const ASPECT_RATIOS = ["1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
const PIECES = ["closing", "share"];

const key = process.env.GEMINI_API_KEY;
// Errors from the API or from fetch must never carry the key into the output.
const scrub = (text) => (key ? String(text).replaceAll(key, "[GEMINI_API_KEY]") : String(text));
const usd = (n) => `$${n.toFixed(3)}`;

function usage(message) {
  if (message) console.error(`generate-art: ${message}`);
  console.error("usage: node scripts/generate-art.mjs <prompt.md> <count> [--ref <image>]...");
  process.exit(2);
}

function parseArgs(argv) {
  const args = { refs: [], positional: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--ref") {
      args.refs.push(argv[++i] ?? usage("--ref needs an image"));
    } else if (argv[i].startsWith("-")) {
      usage(`unknown option ${argv[i]}`);
    } else {
      args.positional.push(argv[i]);
    }
  }
  if (args.positional.length !== 2) usage();
  const [promptFile, countText] = args.positional;
  const count = Number(countText);
  if (!Number.isInteger(count) || count < 1) usage("<count> must be a whole number, 1 or more");
  return { promptFile, count, refs: args.refs };
}

// Frontmatter is "key: value" lines between two "---" lines. Everything after
// it is the prompt.
async function readPrompt(file) {
  const text = await readFile(file, "utf8");
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!match) throw new Error(`${file} has no frontmatter`);
  const meta = {};
  for (const line of match[1].split("\n")) {
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (!kv) throw new Error(`${file}: bad frontmatter line: ${line}`);
    meta[kv[1]] = kv[2].replace(/^"(.*)"$/, "$1");
  }
  const prompt = match[2].trim();
  if (!PIECES.includes(meta.piece)) throw new Error(`${file}: piece must be one of ${PIECES.join(", ")}`);
  if (!/^[1-9]\d*$/.test(meta.round ?? "")) throw new Error(`${file}: round must be a whole number, 1 or more`);
  if (!MODELS[meta.model]) throw new Error(`${file}: model must be one of ${Object.keys(MODELS).join(", ")}`);
  if (!ASPECT_RATIOS.includes(meta.aspect_ratio)) throw new Error(`${file}: unsupported aspect_ratio ${meta.aspect_ratio}`);
  if (!MODELS[meta.model].image[meta.image_size]) throw new Error(`${file}: unsupported image_size ${meta.image_size}`);
  if (prompt === "") throw new Error(`${file} has no prompt`);
  return { ...meta, round: Number(meta.round), prompt };
}

async function readTally() {
  if (!existsSync(TALLY)) return { images: 0, unconfirmed: 0, estimated_usd: 0, runs: [] };
  return JSON.parse(await readFile(TALLY, "utf8"));
}
const used = (tally) => tally.images + tally.unconfirmed;

// The next free number for <name>-<nn>.png in art/candidates/.
async function nextIndex(name) {
  const files = existsSync(CANDIDATES) ? await readdir(CANDIDATES) : [];
  const taken = files
    .map((file) => new RegExp(`^${name}-(\\d+)\\.[a-z]+$`).exec(file))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  return Math.max(0, ...taken) + 1;
}

// Every {type: "image", data} object in the response, with whether it came
// from a model_output step. Thinking can produce draft images too; the
// answer is the last image in the model's output.
function findImages(node, inOutput = false, found = []) {
  if (Array.isArray(node)) {
    for (const item of node) findImages(item, inOutput, found);
  } else if (node && typeof node === "object") {
    if (node.type === "image" && typeof node.data === "string") found.push({ ...node, inOutput });
    const output = inOutput || node.type === "model_output";
    for (const [name, value] of Object.entries(node)) if (name !== "data") findImages(value, output, found);
  }
  return found;
}

function findText(node, found = []) {
  if (Array.isArray(node)) {
    for (const item of node) findText(item, found);
  } else if (node && typeof node === "object") {
    if (node.type === "text" && typeof node.text === "string") found.push(node.text);
    for (const value of Object.values(node)) findText(value, found);
  }
  return found;
}

// The image's own tokens are in the per-image price. Thinking can show up in
// total_thought_tokens or only in total_output_tokens, so take the larger.
function estimateCost(model, imageSize, usage = {}) {
  const prices = MODELS[model];
  const imageOut = (usage.output_tokens_by_modality ?? [])
    .filter((entry) => /image/i.test(entry.modality ?? ""))
    .reduce((sum, entry) => sum + (entry.tokens ?? 0), 0);
  const textOut = Math.max((usage.total_output_tokens ?? 0) - imageOut, usage.total_thought_tokens ?? 0);
  return prices.image[imageSize] + (usage.total_input_tokens ?? 0) * prices.input + textOut * prices.text;
}

// Width and height from a PNG's IHDR or a JPEG's SOF segment.
function imageSize(buffer) {
  if (buffer.readUInt32BE(0) === 0x89504e47) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (buffer.readUInt16BE(0) !== 0xffd8) return null;
  for (let i = 2; i + 9 < buffer.length; ) {
    const marker = buffer.readUInt16BE(i);
    if (marker >= 0xffc0 && marker <= 0xffcf && ![0xffc4, 0xffc8, 0xffcc].includes(marker)) {
      return { width: buffer.readUInt16BE(i + 7), height: buffer.readUInt16BE(i + 5) };
    }
    i += 2 + buffer.readUInt16BE(i + 2);
  }
  return null;
}

async function generate({ model, aspect_ratio, image_size, prompt }, refs) {
  const input = [{ type: "text", text: prompt }];
  for (const ref of refs) input.push({ type: "image", mime_type: ref.mime_type, data: ref.data });
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      model,
      input,
      // No mime_type: the Interactions API only accepts image/jpeg there, and
      // the default is what the model makes.
      response_format: { type: "image", aspect_ratio, image_size },
      // Don't keep the interaction on Google's side (they are kept for 55
      // days by default).
      store: false,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}: ${scrub(body?.error?.message ?? text.slice(0, 500))}`);
    error.answered = true;
    throw error;
  }
  return body;
}

async function main() {
  const { promptFile, count, refs: refFiles } = parseArgs(process.argv.slice(2));
  if (!key) {
    console.error("generate-art: GEMINI_API_KEY is not set");
    process.exit(1);
  }
  const spec = await readPrompt(promptFile);
  const name = path.basename(promptFile, ".md");

  const refs = [];
  for (const refFile of refFiles) {
    const ext = path.extname(refFile).toLowerCase();
    const mime_type = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" }[ext];
    if (!mime_type) usage(`--ref must be a PNG, JPEG or WebP image`);
    refs.push({ file: path.relative(ROOT, path.resolve(refFile)), mime_type, data: (await readFile(refFile)).toString("base64") });
  }

  const tally = await readTally();
  if (used(tally) + count > BUDGET) {
    console.error(`generate-art: refused. ${used(tally)} of ${BUDGET} images used, and this run asks for ${count}.`);
    process.exit(1);
  }

  await mkdir(CANDIDATES, { recursive: true });
  const run = { date: new Date().toISOString(), prompt_file: path.relative(ROOT, path.resolve(promptFile)), model: spec.model, images: 0, estimated_usd: 0 };
  tally.runs.push(run);
  let failed = null;

  for (let i = 0; i < count; i++) {
    const date = new Date().toISOString();
    process.stdout.write(`${name}: requesting image ${i + 1} of ${count} from ${spec.model} (${spec.image_size}, ${spec.aspect_ratio})... `);
    let body;
    try {
      body = await generate(spec, refs);
    } catch (error) {
      // No answer means an image may have been made and billed anyway.
      if (!error.answered) tally.unconfirmed += 1;
      await writeFile(TALLY, `${JSON.stringify(tally, null, 2)}\n`);
      console.log("failed");
      failed = error.answered ? error.message : `no answer (${scrub(error.message)}), counted against the budget`;
      break;
    }

    const images = findImages(body);
    const image = images.filter((found) => found.inOutput).at(-1) ?? images.at(-1);
    if (!image) {
      console.log("no image");
      failed = `the response had no image. Text: ${scrub(findText(body).join(" ").slice(0, 500) || "(none)")}`;
      break;
    }

    const bytes = Buffer.from(image.data, "base64");
    const ext = image.mime_type === "image/jpeg" ? "jpg" : image.mime_type === "image/webp" ? "webp" : "png";
    const file = `${name}-${String(await nextIndex(name)).padStart(2, "0")}.${ext}`;
    const cost = estimateCost(spec.model, spec.image_size, body.usage);
    const size = imageSize(bytes);
    await writeFile(path.join(CANDIDATES, file), bytes);
    await writeFile(
      path.join(CANDIDATES, file.replace(/\.[a-z]+$/, ".json")),
      `${JSON.stringify(
        {
          file,
          piece: spec.piece,
          round: spec.round,
          model: spec.model,
          prompt_file: run.prompt_file,
          prompt: spec.prompt,
          aspect_ratio: spec.aspect_ratio,
          image_size: spec.image_size,
          refs: refs.map((ref) => ref.file),
          date,
          width: size?.width ?? null,
          height: size?.height ?? null,
          interaction_id: body.id ?? null,
          response_steps: Array.isArray(body.steps) ? body.steps.map((step) => step.type) : null,
          text: findText(body).join("\n") || null,
          usage: body.usage ?? null,
          estimated_usd: cost,
          ai_generated: "Google Gemini; carries Google's SynthID watermark",
        },
        null,
        2,
      )}\n`,
    );

    tally.images += 1;
    tally.estimated_usd += cost;
    run.images += 1;
    run.estimated_usd += cost;
    await writeFile(TALLY, `${JSON.stringify(tally, null, 2)}\n`);
    console.log(`${file}${size ? ` (${size.width}x${size.height})` : ""}, about ${usd(cost)}`);
  }

  await writeContactSheet();
  console.log(`This run made ${run.images} image${run.images === 1 ? "" : "s"}, about ${usd(run.estimated_usd)}.`);
  console.log(
    `In all: ${tally.images} image${tally.images === 1 ? "" : "s"}` +
      (tally.unconfirmed ? ` and ${tally.unconfirmed} unanswered request${tally.unconfirmed === 1 ? "" : "s"}` : "") +
      `, ${used(tally)} of ${BUDGET} used, about ${usd(tally.estimated_usd)}.`,
  );
  if (failed) {
    console.error(`generate-art: stopped: ${failed}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`generate-art: ${scrub(error.stack ?? error)}`);
  process.exit(1);
});
