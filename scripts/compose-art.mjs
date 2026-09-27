// Makes the shipped art from the chosen source in art/source/ (see
// art/README.md):
//
//   closing  src/assets/closing-art.png, 1056x528: the source cropped in to
//            its artwork, with the edges feathered into --raised.
//   share    public/og.png, 1200x630: the source's artwork scaled into the
//            right of the frame on --bg, with the mark and the "delocal"
//            wordmark on the left.
//
// Usage: node scripts/compose-art.mjs [--closing <image>] [--share <image>] [--out <dir>]
//
// --closing and --share try other sources, and --out writes closing.png,
// share.png and compose.json (what was done) to <dir> instead, for the contact
// sheet.
//
// Each source is first remapped so its background, measured round its edges,
// is exactly the token colour. The model's flat background is a few levels
// off, which would otherwise show as a seam. The artwork's bounding box is
// found by comparing each pixel with that background.
//
// The wordmark is never drawn by the model. It is the site's own Martian Mono
// (weight 400, width 112.5%, which is the font's default instance), as vector
// outlines with -0.02em tracking, like .wordmark in global.css. The mark is
// Mark.astro's three circles.
import { create } from "fontkitten";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FONT = path.join(ROOT, "node_modules/@fontsource-variable/martian-mono/files/martian-mono-latin-standard-normal.woff2");

const TOKENS = {
  bg: "#14152a",
  raised: "#1d1f3d",
  ink: "#eceaf4",
  amber: "#f5b947",
  cyan: "#5fd4e6",
  violet: "#b39bff",
};

const CLOSING = {
  source: "art/source/closing.jpg",
  output: "src/assets/closing-art.png",
  width: 1056,
  height: 528,
  background: TOKENS.raised,
  // Space round the artwork's bounding box, as a share of its larger side.
  pad: 0.05,
  // How far in from each edge the feathering reaches, as a share of the height.
  feather: 0.12,
};

// Both pieces come from the same source, so they show the same desk.
const SHARE = {
  source: "art/source/closing.jpg",
  output: "public/og.png",
  width: 1200,
  height: 630,
  background: TOKENS.bg,
  pad: 0.04,
  feather: 0.08,
  // The artwork goes in this box, scaled to fit and aligned to its right. It
  // starts past 45% of the width, which stays calm for the wordmark.
  art: { left: 580, top: 40, right: 1160, bottom: 590 },
  // The mark and wordmark, vertically centred, in the nav's proportions: a
  // 44px mark and a 16px gap beside a 24px wordmark. The wordmark is 56px, as
  // on the holding page, so the pair ends well inside the calm 45%.
  brand: { left: 80, fontSize: 56, markWidth: (56 * 44) / 24, gap: (56 * 16) / 24 },
  // og.png must be 300 KB or less. Over that, it is quantised to a palette.
  maxBytes: 300 * 1024,
};

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const rgbToHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

async function loadRgb(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

// The median colour of the outer 3% of the image.
function edgeColour({ data, width, height }) {
  const band = Math.round(Math.min(width, height) * 0.03);
  const channels = [[], [], []];
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (x >= band && y >= band && x < width - band && y < height - band) continue;
      const i = (y * width + x) * 3;
      for (let c = 0; c < 3; c++) channels[c].push(data[i + c]);
    }
  }
  return channels.map((values) => values.sort((a, b) => a - b)[values.length >> 1]);
}

// Maps each channel piecewise-linearly so that `from` becomes `to`, while 0
// and 255 stay put.
function remap(image, from, to) {
  const lut = from.map((f, c) =>
    Uint8Array.from({ length: 256 }, (_, v) =>
      Math.round(v <= f ? (to[c] * v) / Math.max(f, 1) : to[c] + ((v - f) * (255 - to[c])) / Math.max(255 - f, 1)),
    ),
  );
  const data = Buffer.alloc(image.data.length);
  for (let i = 0; i < data.length; i++) data[i] = lut[i % 3][image.data[i]];
  return { ...image, data };
}

// The bounding box of everything that isn't background, found on a blurred
// quarter-size copy so paper grain and halftone dots don't count. Rows and
// columns with only a few such pixels are ignored.
async function artBox(image, background) {
  const scale = 4;
  const { data, info } = await sharp(image.data, { raw: { width: image.width, height: image.height, channels: 3 } })
    .resize(Math.round(image.width / scale), Math.round(image.height / scale))
    .blur(1.5)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rows = new Array(info.height).fill(0);
  const cols = new Array(info.width).fill(0);
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 3;
      const diff = Math.max(...[0, 1, 2].map((c) => Math.abs(data[i + c] - background[c])));
      if (diff > 28) {
        rows[y]++;
        cols[x]++;
      }
    }
  }
  const first = (counts) => counts.findIndex((n) => n >= 4);
  const last = (counts) => counts.length - 1 - [...counts].reverse().findIndex((n) => n >= 4);
  const left = first(cols) * scale;
  const top = first(rows) * scale;
  const right = (last(cols) + 1) * scale;
  const bottom = (last(rows) + 1) * scale;
  return { left, top, width: right - left, height: bottom - top };
}

// Crops `box` out of the image. Any part of the box outside the image is
// filled with `background`.
function cropRaw(image, box, background) {
  const data = Buffer.alloc(box.width * box.height * 3);
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      const sx = box.left + x;
      const sy = box.top + y;
      const o = (y * box.width + x) * 3;
      if (sx >= 0 && sy >= 0 && sx < image.width && sy < image.height) {
        image.data.copy(data, o, (sy * image.width + sx) * 3, (sy * image.width + sx) * 3 + 3);
      } else {
        data[o] = background[0];
        data[o + 1] = background[1];
        data[o + 2] = background[2];
      }
    }
  }
  return { data, width: box.width, height: box.height };
}

// An RGBA copy whose alpha falls smoothly to 0 over `reach` pixels at every
// edge, so it can be laid on a flat background with no visible edge.
function feathered({ data, width, height }, reach) {
  const out = Buffer.alloc(width * height * 4);
  const smooth = (t) => (t >= 1 ? 1 : t * t * (3 - 2 * t));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = Math.min(x, y, width - 1 - x, height - 1 - y);
      const i = y * width + x;
      out[i * 4] = data[i * 3];
      out[i * 4 + 1] = data[i * 3 + 1];
      out[i * 4 + 2] = data[i * 3 + 2];
      out[i * 4 + 3] = Math.round(255 * smooth(d / reach));
    }
  }
  return out;
}

// Pads a box by `pad` of its larger side, then grows it to the aspect ratio
// `aspect` (width / height) about its centre.
function frame(box, pad, aspect) {
  const p = Math.max(box.width, box.height) * pad;
  let width = box.width + 2 * p;
  let height = box.height + 2 * p;
  if (width / height < aspect) width = height * aspect;
  else height = width / aspect;
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  return { left: Math.round(cx - width / 2), top: Math.round(cy - height / 2), width: Math.round(width), height: Math.round(height) };
}

async function prepare(file, background) {
  const raw = await loadRgb(file);
  const measured = edgeColour(raw);
  const image = remap(raw, measured, hexToRgb(background));
  const box = await artBox(image, hexToRgb(background));
  return { image, measured, box, size: { width: raw.width, height: raw.height } };
}

async function composeClosing(file) {
  const { image, measured, box, size } = await prepare(file, CLOSING.background);
  const crop = frame(box, CLOSING.pad, CLOSING.width / CLOSING.height);
  const cropped = cropRaw(image, crop, hexToRgb(CLOSING.background));
  const resized = await sharp(cropped.data, { raw: { width: crop.width, height: crop.height, channels: 3 } })
    .resize(CLOSING.width, CLOSING.height, { kernel: "lanczos3" })
    .raw()
    .toBuffer();
  const tile = feathered({ data: resized, width: CLOSING.width, height: CLOSING.height }, CLOSING.height * CLOSING.feather);
  const png = await sharp({ create: { width: CLOSING.width, height: CLOSING.height, channels: 3, background: CLOSING.background } })
    .composite([{ input: tile, raw: { width: CLOSING.width, height: CLOSING.height, channels: 4 } }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { png, record: { source: path.relative(ROOT, file), source_size: size, measured_background: rgbToHex(measured), art_box: box, crop } };
}

// The mark and wordmark as SVG, laid out as .brand on the holding page.
async function brandSvg({ left, fontSize, markWidth, gap }, width, height) {
  const font = create(await readFile(FONT));
  const em = fontSize / font.unitsPerEm;
  // Centre the wordmark's line box (line-height 1) on the frame, as flexbox
  // does on the site. The ascent and descent overflow the 1em box equally.
  // Browsers put the baseline on a whole pixel.
  const baseline = Math.floor(height / 2 + ((font.ascent + font.descent) / 2) * em);
  const tracking = -0.02 * fontSize;
  let x = left + markWidth + gap;
  const glyphs = [];
  for (const ch of "delocal") {
    const glyph = font.glyphForCodePoint(ch.codePointAt(0));
    glyphs.push(`<path transform="translate(${x.toFixed(2)} ${baseline.toFixed(2)}) scale(${em} ${-em})" d="${glyph.path.toSVG()}"/>`);
    x += glyph.advanceWidth * em + tracking;
  }
  // Mark.astro's 44x16 grid, centred on the line box like the site's
  // align-items: center.
  const k = markWidth / 44;
  const markTop = height / 2 - 8 * k;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
<g transform="translate(${left} ${markTop.toFixed(2)}) scale(${k.toFixed(4)})">
<circle cx="4.5" cy="8" r="4.5" fill="${TOKENS.cyan}"/><circle cx="22" cy="8" r="5.5" fill="${TOKENS.amber}"/><circle cx="39.5" cy="8" r="4.5" fill="${TOKENS.violet}"/>
</g>
<g fill="${TOKENS.ink}">${glyphs.join("")}</g>
</svg>`;
}

async function composeShare(file) {
  const { image, measured, box, size } = await prepare(file, SHARE.background);
  const p = Math.round(Math.max(box.width, box.height) * SHARE.pad);
  const crop = { left: box.left - p, top: box.top - p, width: box.width + 2 * p, height: box.height + 2 * p };
  const cropped = cropRaw(image, crop, hexToRgb(SHARE.background));

  const area = SHARE.art;
  const scale = Math.min((area.right - area.left) / crop.width, (area.bottom - area.top) / crop.height);
  const w = Math.round(crop.width * scale);
  const h = Math.round(crop.height * scale);
  const placed = { left: area.right - w, top: Math.round((SHARE.height - h) / 2), width: w, height: h };
  const resized = await sharp(cropped.data, { raw: { width: crop.width, height: crop.height, channels: 3 } })
    .resize(w, h, { kernel: "lanczos3" })
    .raw()
    .toBuffer();
  const tile = feathered({ data: resized, width: w, height: h }, Math.min(w, h) * SHARE.feather);

  const composed = sharp({ create: { width: SHARE.width, height: SHARE.height, channels: 3, background: SHARE.background } }).composite([
    { input: tile, raw: { width: w, height: h, channels: 4 }, left: placed.left, top: placed.top },
    { input: Buffer.from(await brandSvg(SHARE.brand, SHARE.width, SHARE.height)), left: 0, top: 0 },
  ]);
  const flat = await composed.png({ compressionLevel: 9 }).toBuffer();
  let png = flat;
  let quantised = false;
  if (flat.length > SHARE.maxBytes) {
    png = await sharp(flat).png({ compressionLevel: 9, palette: true, colours: 256, quality: 100, dither: 1 }).toBuffer();
    quantised = true;
  }
  if (png.length > SHARE.maxBytes) throw new Error(`og.png is ${png.length} bytes, over ${SHARE.maxBytes}`);
  return {
    png,
    record: {
      source: path.relative(ROOT, file),
      source_size: size,
      measured_background: rgbToHex(measured),
      art_box: box,
      crop,
      placed,
      bytes: png.length,
      quantised,
    },
  };
}

function parseArgs(argv) {
  const args = { closing: CLOSING.source, share: SHARE.source, out: null };
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i].replace(/^--/, "");
    if (!["closing", "share", "out"].includes(name) || !argv[i].startsWith("--") || argv[i + 1] === undefined) {
      console.error("usage: node scripts/compose-art.mjs [--closing <image>] [--share <image>] [--out <dir>]");
      process.exit(2);
    }
    args[name] = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const closing = await composeClosing(path.resolve(ROOT, args.closing));
const share = await composeShare(path.resolve(ROOT, args.share));
const outputs = args.out
  ? { closing: path.join(args.out, "closing.png"), share: path.join(args.out, "share.png") }
  : { closing: path.join(ROOT, CLOSING.output), share: path.join(ROOT, SHARE.output) };
await mkdir(path.dirname(outputs.closing), { recursive: true });
await mkdir(path.dirname(outputs.share), { recursive: true });
await writeFile(outputs.closing, closing.png);
await writeFile(outputs.share, share.png);
if (args.out) {
  await writeFile(path.join(args.out, "compose.json"), `${JSON.stringify({ closing: closing.record, share: share.record }, null, 2)}\n`);
}
for (const [name, result, file] of [
  ["closing", closing, outputs.closing],
  ["share", share, outputs.share],
]) {
  const r = result.record;
  console.log(
    `${name}: ${r.source} (background ${r.measured_background}, art ${r.art_box.width}x${r.art_box.height} at ${r.art_box.left},${r.art_box.top})` +
      ` -> ${path.relative(ROOT, path.resolve(file))}, ${Math.round(result.png.length / 1024)} KB${r.quantised ? ", palette" : ""}`,
  );
}
