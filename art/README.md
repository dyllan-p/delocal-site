# Art

The site has two pieces of art, and both are AI-generated. They were made
with Google's Gemini image models and carry Google's SynthID watermark, which
is invisible. The orbit art (`OrbitArt.astro`) is drawn in SVG, not generated.

## What ships

| File | What it is |
| --- | --- |
| [`src/assets/closing-art.png`](../src/assets/closing-art.png) | The closing band's art on the landing page (full mode), 1056x528. Astro serves it as AVIF and WebP at 528 and 1056 wide. It is decorative (`alt=""`). |
| [`public/og.png`](../public/og.png) | The share image at `/og.png`, 1200x630, used as `og:image` and `twitter:image` on every page in both modes. |

Both are made by [`scripts/compose-art.mjs`](../scripts/compose-art.mjs) from
one source image, [`source/closing.jpg`](source/closing.jpg), so they show the
same desk.

### source/closing.jpg

- **AI-generated** with Google Gemini. It carries Google's SynthID watermark.
- **Model:** `gemini-3-pro-image`, at 2K and 16:9, through the Interactions
  API.
- **Date:** 2026-09-27 (16:00 UTC).
- **File:** 2752x1536 JPEG, exactly as the API returned it. SHA-256
  `32430373a96764c2222ac5137de7e1f81df32e314ba31c54b54e4d91841fe04d`.
- **Prompt:** [`prompts/closing-f-refine-2.md`](prompts/closing-f-refine-2.md),
  quoted in full below.
- **Reference images.** The prompt was sent with two earlier candidates, in
  this order. They aren't committed.
  1. `closing-f-01.jpg`: `gemini-3-pro-image` at 1K and 16:9, 2026-09-27,
     from [`prompts/closing-f.md`](prompts/closing-f.md).
  2. `share-f-02.jpg`: `gemini-3-pro-image` at 1K and 16:9, 2026-09-27, from
     [`prompts/share-f.md`](prompts/share-f.md).

The prompt, exactly as sent:

```text
Redraw the first image as a finished illustration, keeping its composition, its night-time desk, its 1980s computer-magazine print style, and the soft, dotted amber cloud of light drifting between the three machines. The second image shows the same desk and style in another layout; use it only to keep the two consistent.

Make these changes, and follow each one exactly:

- Size: the group fills more of the frame than in the first image, taking up most of the width. Every object stays whole and inside the frame, with a margin of flat background at every edge. Nothing is cut off.
- The laptop's screen glows cyan (#5fd4e6) and shows only two or three simple abstract shapes, like the desktop's. Do not copy the small mark in the top-left of the first image's laptop screen, the block with an underscore after it. No cursor, underscore, arrow or prompt on either screen, and nothing letter-like anywhere, including on the machines' cases.
- The desktop's CRT screen glows violet (#b39bff) and shows simple abstract shapes.
- The home server, on the right, is a small box with no screen, display, window or handle. Its front has only a row of two or three small round indicator lights and some vent slots, and a soft rose (#ff8fa3) glow falls around it. It is not a computer, and it is not shaped like any Apple product.
- The mug is an outline drawing in off-white (#eceaf4) line work on the dark background, with no fill and no pattern or shapes on it.
- The plant and its pot are an outline drawing in off-white (#eceaf4) line work, with no fill: no green, cyan or violet leaves.
- Colour has jobs: amber (#f5b947) is only for the cloud of light, and cyan, violet and rose are only for the glows of the three machines. The machines' cases stay pale cream with off-white line work, with no coloured buttons.
- No paper border, frame, colour swatches or box. Towards every edge the image falls off to the flat #1d1f3d background.

Keep the limited palette of flat inks on the deep indigo #1d1f3d background, the subtle halftone dots and paper grain, and the clean, confident line work. Warm, cosy, quiet and a little magical. Not photorealistic: no 3D rendering, no glossy highlights, no gradients that look airbrushed. No people, no mascot or character, and no readable text, letters, numbers or symbols anywhere.
```

### What compose-art.mjs does to it

Nothing is painted over or retouched. The script:

1. **Matches the background.** It remaps each colour channel so that the
   source's background becomes exactly the token colour: `--raised` for the
   closing art, `--bg` for the share image. It measures the background as
   the median colour round the edges. The model's own background is a few
   levels off, and that would show as a seam.
2. **Finds the artwork.** Its bounding box is every part of the image that
   differs clearly from the background.
3. **Closing art.** It crops to the artwork, with 5% to spare, at 2:1. Then
   it scales that to 1056x528 and feathers the edges into `--raised`.
4. **Share image.** It crops to the artwork and scales it into x 580–1160,
   aligned right, so the left 45% stays calm. It feathers the edges into
   `--bg`.
   - Then it adds the mark and the "delocal" wordmark on the left,
     vertically centred.
   - The wordmark is vector outlines from the site's Martian Mono. The
     font's default instance is weight 400 and width 112.5%, exactly the
     wordmark's settings, and the tracking is −0.02em.
   - The mark is `Mark.astro`'s three circles.
   - The sizes follow the nav: a 44px mark, then a 16px gap, beside a
     24px wordmark, here scaled to a 56px wordmark.
   - If the result is over 300 KB, it is quantised to a 256-colour palette.
     It is about 100 KB.

## Making art

You need `GEMINI_API_KEY` in the environment to generate images. Nothing else
needs it. Composing and building work from the committed files.

| Command | What it does |
| --- | --- |
| `node scripts/generate-art.mjs <prompt.md> <count> [--ref <image>]...` | Makes `<count>` images from a prompt in `art/prompts/`, one request each. Each `--ref` sends an image with the prompt, in the order given. |
| `node scripts/contact-sheet.mjs` | Rebuilds `art/candidates/index.html`. `generate-art.mjs` also runs it after each run. |
| `node scripts/compose-art.mjs` | Writes `src/assets/closing-art.png` and `public/og.png` from `art/source/closing.jpg`. Commit all three together. |
| `node scripts/compose-art.mjs --closing <image> --share <image> --out <dir>` | Composes other sources into `<dir>` for review. With `<dir>` set to `art/candidates/composed-<name>`, the contact sheet shows the result. |

**Prompt files.**
- The frontmatter sets the piece (`closing` or `share`), the round it belongs
  to on the contact sheet, the model, the aspect ratio and the size.
- The rest of the file is the prompt, sent exactly.
- The `round` lines on the round 1 prompts were added after those images
  were made. The prompts themselves haven't changed. Each candidate's record
  holds the prompt that was sent, and they all match the files.

**Output.**
- Images go to `art/candidates/<prompt name>-<nn>.jpg`, each with a `.json`
  record: the model, the prompt, the size, the reference images, the date,
  the token usage and an estimated cost.
- The contact sheet, `art/candidates/index.html`, shows each candidate on its
  real background at its real size.
- `art/candidates/` is gitignored.

**Budget.**
- The script refuses a run that would take the total past 40 images.
- The total is kept in `art/.tally.json`, which is gitignored and so is
  local to one checkout.
- A request that ends with no answer, such as a timeout, may still have made
  an image, so it counts as one.
- The script prints each run's images and a running estimated cost. The
  prices are from the Gemini pricing page on 2026-09-27: $0.067 per 1K image
  from `gemini-3.1-flash-image`, and $0.134 per 1K or 2K image from
  `gemini-3-pro-image`, plus input and thinking tokens.

**API details.**
- Requests go to `POST /v1beta/interactions`, with the key only in the
  `x-goog-api-key` header.
- They set `store: false`, so Google doesn't keep the interaction. By default
  it keeps interactions for 55 days.
- The API returns JPEG. It accepts no other `response_format.mime_type` for
  images.

## Art direction

For any future art, so it matches:

- **Style.** A 1980s computer-magazine illustration, printed in a few flat
  inks, with subtle halftone dots, paper grain and clean, confident line
  work. Warm and hand-made. Not photorealistic, no 3D-render gloss and no
  airbrushed gradients.
- **Colour, by DESIGN.md's colour rule.**
  - The laptop glows cyan, the desktop violet and the home server rose.
  - Amber is only the cloud of light drifting between them, the one thing
    present on all three machines.
  - Line work and props are off-white (`--ink`) on the background token.
- **Never:**
  - text, letters, numbers or anything letter-like, including cursors such
    as `▮_` or `>_`;
  - logos, brand shapes or Apple shapes;
  - people, mascots, frames or borders.
- **Edges** fall off to the flat background. `compose-art.mjs` feathers them
  into the exact token colour.

## How these were chosen

PR 6 used 22 of the 40 images, for an estimated $2.52.

1. **Round 1, soft abstract glows,** with and without line-drawn machines.
   `gemini-3.1-flash-image`, 1K, 8 images, from `closing-a`, `closing-b`,
   `share-a` and `share-b`. None was picked: the site wanted real
   illustration.
2. **Round 2, the 1980s magazine style.** `gemini-3-pro-image`, 1K,
   8 images.
   - **E** was a mascot: `closing-e`, `share-e`.
   - **F** was a desk scene: `closing-f`, `share-f`.

   F was picked, as `closing-f-01` and `share-f-02`. The mascot was too
   cute.
3. **Round 3, refinements at 2K.** `gemini-3-pro-image`, 6 images. Each pick
   was the first reference and the other pick the second.
   - **Closing.** `closing-f-refine` made two versions, and both still broke
     rules. `closing-f-refine-2`, with every fix spelled out, met all of
     them. It is `source/closing.jpg`.
   - **Share.** No share version met every rule. The model kept drawing
     cursors, Apple shapes or a server with a screen. So the share image
     uses the closing source too.
