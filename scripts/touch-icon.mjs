// Makes public/apple-touch-icon.png, the home-screen icon: the logo mark from
// public/favicon.svg, centred on --bg at 180x180. iOS rounds the corners
// itself and fills any transparency with black, so the background is opaque.
//
// Usage: node scripts/touch-icon.mjs
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const OUT = fileURLToPath(new URL("public/apple-touch-icon.png", root));

const SIZE = 180;
// favicon.svg is a 44x44 square with the 44x16 mark across its middle. At 3x
// the mark is 132x48, with 24px on each side.
const ICON = 132;

const tokens = await readFile(new URL("src/styles/tokens.css", root), "utf8");
const bg = /--bg:\s*(#[0-9a-f]{6})\b/i.exec(tokens)?.[1];
if (!bg) throw new Error("no --bg in src/styles/tokens.css");

const favicon = await readFile(new URL("public/favicon.svg", root));
const mark = await sharp(favicon, { density: (72 * ICON) / 44 })
  .resize(ICON, ICON)
  .png()
  .toBuffer();

const offset = (SIZE - ICON) / 2;
await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: bg } })
  .composite([{ input: mark, left: offset, top: offset }])
  .png({ palette: true, compressionLevel: 9 })
  .toFile(OUT);

console.log(`wrote ${path(OUT)}: ${SIZE}x${SIZE}, the mark ${ICON}px wide on ${bg}`);

function path(file) {
  return file.replace(fileURLToPath(root), "");
}
