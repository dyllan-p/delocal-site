// The share image, /og.png, made by scripts/compose-art.mjs (see art/README.md).
// Every page carries these tags: Base.astro renders them, and astro.config.mjs
// gives them to Starlight's head config for the docs.
import { SITE_URL } from "../../site.config.mjs";

export const SHARE_IMAGE_URL = new URL("/og.png", SITE_URL).href;

// Describes the picture itself. Keep it in step with the art.
const alt =
  "The delocal logo and wordmark beside a drawing of a night-time desk: a retro laptop glowing cyan, " +
  "a CRT desktop glowing violet and a small home server glowing rose, with a soft amber cloud of light " +
  "drifting between them.";

export const shareImageMeta = [
  { property: "og:image", content: SHARE_IMAGE_URL },
  { property: "og:image:width", content: "1200" },
  { property: "og:image:height", content: "630" },
  { property: "og:image:alt", content: alt },
  { name: "twitter:image", content: SHARE_IMAGE_URL },
  { name: "twitter:image:alt", content: alt },
];
