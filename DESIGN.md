# delocal.sh design

Read this before touching any page.

The visual reference is [`design/mockup.pdf`](design/mockup.pdf), the mockup
canvas exported from Claude. Use it for layout and proportions. Where it
disagrees with this file, this file wins. The tokens in
[`src/styles/tokens.css`](src/styles/tokens.css) are this file in code, so
keep the two in step.

The PDF has three pages:

1. **Landing page, dark.** The full site's home page, described under
   [Landing page](#landing-page-full-mode).
2. **Hero, light.** Ignore it. The site is dark only.
3. **Holding page.** What the public site shows until launch, described
   under [Holding page](#holding-page). It is built.

All measurements are CSS pixels on the 1440px canvas. The PDF renders at
that size at 96 dpi.

## Rules that shape the design

- **Claim nothing the code doesn't do yet.** The mockup's copy is a sketch,
  not approved text. Until something is true in
  [delocal](https://github.com/dyllan-p/delocal), its section ships as
  `<p class="ph">[Placeholder: what goes here]</p>`. A production build fails
  while any placeholder remains.
- **Terminal examples are tagged "illustrative"**, in the title bar.
- **No** stats, logos, testimonials or FAQ.
- **Dark only.** No light theme, no toggle, no `prefers-color-scheme`
  queries, no `data-theme` script. `:root` has `color-scheme: dark`.
- **Everything self-hosted.** No fonts, scripts or images from another host.
  The build fails if a page or stylesheet loads one.

## Colour

| Token          | Value     | Use                                                        |
| -------------- | --------- | ---------------------------------------------------------- |
| `--bg`         | `#14152a` | Page background. Text on amber buttons.                    |
| `--surface`    | `#181a33` | Cards: the art card and the command cards.                 |
| `--raised`     | `#1d1f3d` | Large panels (the "Follow the build" panel), Copy button.  |
| `--terminal`   | `#0e0f20` | Terminal windows, the install box, code boxes.             |
| `--rule`       | `#2a2c4a` | 1px section rules, terminal and install box borders.       |
| `--rule-strong`| `#3a3c62` | Pill borders, dashed orbits, dashed placeholder boxes.     |
| `--ink`        | `#eceaf4` | Headings, the wordmark, line-drawn icons.                  |
| `--text-2`     | `#c3c4dc` | Body text, ledes, nav links.                               |
| `--muted`      | `#a4a6c4` | Secondary text, art particles.                             |
| `--faint`      | `#8d8fb0` | Notes, captions, terminal timestamps, placeholders.        |
| `--amber`      | `#f5b947` | Primary accent: buttons (with `--bg` text), the prompt `$`, link underlines, the status dot. |
| `--cyan`       | `#5fd4e6` | Machine colour: laptop.                                    |
| `--violet`     | `#b39bff` | Machine colour: nas. Also the "illustrative" tag.          |
| `--rose`       | `#ff8fa3` | The "trash" label in the safety section.                   |
| `--green`      | `#7ee2a8` | Success marks only, such as the terminal's `✓`.            |

**Machines always keep their colour:** laptop cyan, desk amber, nas violet.
That holds in terminals, the logo mark and the art. The tokens are
`--laptop`, `--desk` and `--nas`. Use those names when the colour means a
machine.

## Type

All three are variable fonts from `@fontsource-variable`, imported once in
[`src/styles/fonts.css`](src/styles/fonts.css).

| Role                     | Font                       | Settings                                              |
| ------------------------ | -------------------------- | ----------------------------------------------------- |
| Wordmark                 | Martian Mono               | weight 400, `font-stretch: 112.5%` (wdth), −0.02em     |
| Headings                 | Martian Mono               | weight 500, `font-stretch: 87.5%`, −0.03em             |
| h1                       |                            | 60px / 1.08                                           |
| h2                       |                            | 40px / 1.15                                           |
| Body                     | Atkinson Hyperlegible Next | 17px / 1.55                                           |
| Hero lede                | Atkinson Hyperlegible Next | 21px / 1.5                                            |
| Terminals, code, "$ install" | JetBrains Mono         | 15–16px                                               |

Martian Mono comes from `standard.css`, which has both the wght and wdth
axes. On narrow screens h1 and h2 scale down with `clamp()` to 38px and 28px.

## Layout

- **Canvas:** 1440px, 96px side padding (`--gutter`), so content spans
  1248px.
- **Hero:** two equal columns, 592px each, with a 64px gap. Other two-column
  sections use the same grid.
- **Sections:** separated by 1px `--rule` lines that run inside the side
  padding. The nav's bottom rule is full width.
- **Rhythm:** 88px vertical padding per section (`--rhythm`). The hero has
  about 104px above it.
- **Narrow screens:** below 900px everything stacks to one column. The side
  padding and rhythm shrink with `clamp()`, and nothing scrolls sideways.

### Radii

| Element                 | Radius |
| ----------------------- | ------ |
| Buttons                 | 10px   |
| Install box             | 12px   |
| Terminals and cards     | 16px   |
| Large panels            | 28px   |
| Pills                   | fully round |

## Components

**Logo mark.** Three dots on a 44×16 grid, all on `cy=8`:

- cyan `r4.5` at `cx=4.5`
- amber `r5.5` at `cx=22`
- violet `r4.5` at `cx=39.5`

The outer dots touch the grid edges. It is
[`Mark.astro`](src/components/Mark.astro), `public/favicon.svg` and
`src/assets/mark.svg` (the Starlight logo). It shows at 44px in the nav and
at 50px next to the holding page's wordmark.

**Wordmark.** "delocal" in lower case, set as described under
[Type](#type), 14–18px after the mark. It is 24px in the nav and 56px on the
holding page.

**Status pill.** 1px `--rule-strong` border, fully round, an 8px amber dot,
then 14–16px `--text-2` text.

**Buttons.** `--amber` background, `--bg` text, radius 10, about 44px tall.
The nav's "$ install" button and "Watch on GitHub" use JetBrains Mono.

**Install box.** `--terminal` background, 1px `--rule` border, radius 12,
60px tall. Inside: an amber `$`, the command in JetBrains Mono 16px, and a
"Copy" button on the right (`--raised`, radius 8).

**Terminal window.**
- **Frame:** `--terminal` background, 1px `--rule` border, radius 16.
- **Title bar:** about 50px tall with a `--rule` bottom border. On the left,
  three 10px dots in cyan, amber and violet. In the centre, the title (for
  example `~/Sync`) in `--faint`. On the right, a violet "illustrative" tag:
  `--violet` background, `--bg` text, JetBrains Mono 12px, radius 4.
- **Body:** 26px padding, JetBrains Mono 15px on 26px lines. The prompt
  symbol is amber. Machine names are in their colour. A success mark is
  green.
- **Alignment:** use fixed-width columns (`white-space: pre`, or a grid
  sized in `ch`). The mockup's hero terminal has overlapping columns
  ("uptailnet", "filespeers"). That is a rendering fault, not the design.

**Cards.** `--surface` background, radius 16, no border.

**Large panel.** `--raised` background, radius 28, about 72px padding.

**Placeholders.** `.ph` in
[`src/styles/placeholder.css`](src/styles/placeholder.css): a dashed
`--rule-strong` box, radius 16, `--faint` JetBrains Mono 14px.

## Motion

None, except what answers a click, such as a "Copied" state on the Copy
button. There is no transition on hover or scroll, and nothing animates on
load. `prefers-reduced-motion: reduce` turns off any animation and
transition.

## Implementation notes

- **Scoped styles.** Astro scoped styles don't reach a child component's
  root element. To space or size a child component, put a wrapper element
  around it and style the wrapper, as `.brand-mark` does around `<Mark />`.
- **Colours in inline SVG.** Set them with classes in the component's
  `<style>`, using the tokens, rather than hard-coding hex values.
- **Starlight (docs, full mode only).** Starlight is locked dark in three
  ways:
  - [`ThemeSelect`](src/components/starlight/ThemeSelect.astro) and
    [`ThemeProvider`](src/components/starlight/ThemeProvider.astro) are
    overridden with empty components, so there is no picker and no theme
    script.
  - `<html>` keeps the `data-theme="dark"` that Starlight renders.
  - [`starlight.css`](src/styles/starlight.css) maps Starlight's colour and
    font variables onto our tokens.

  Expressive Code uses one dark theme. The current sidebar item is an amber
  button with `--bg` text.

## Holding page

[`src/components/Holding.astro`](src/components/Holding.astro) and
[`HoldingArt.astro`](src/components/HoldingArt.astro). Page 3 of the mockup.
This is the only real copy on the site.

- **Frame:** two equal columns with a 64px gap, vertically centred in the
  viewport, 120px side padding, content up to 1440px wide.
- **Left column**, with 28px between items:
  - The mark at 50px, 18px gap, then the wordmark at 56px.
  - Lede at 24px/1.5 in `--text-2`, at most 520px wide: "A file sync tool
    being built to keep one folder the same on all your Linux and macOS
    machines, over Tailscale."
  - Status pill at 16px: "In development. There are no releases yet, so
    there is nothing to install."
  - A link to `github.com/dyllan-p/delocal` in JetBrains Mono 16px, with an
    amber underline.
- **Right column:** an inline SVG of one file drawn as a cloud over a
  laptop, a desktop and a server. It renders without JavaScript, and its
  coordinates are 1:1 with the canvas, centred on the centre dot:
  - Three dashed elliptical orbits in `--rule-strong`: one wide (226×123)
    and two near-circles (160×168) tilted ±14°.
  - Three radial glows of radius 100, fading from 0.55 opacity to 0: cyan
    behind the laptop (left), amber behind the desktop (right), violet
    behind the server (bottom).
  - Thin (1.5px) `--ink` line-drawn machine icons.
  - A scatter of small `--muted` particles.
  - A white (`--ink`) centre dot ringed in amber.
- **Under 900px:** one column, text first, art below.

In the mockup the violet glow is clipped at the bottom. That is a mockup
fault; the build draws the whole glow.

## Landing page (full mode)

Page 1 of the mockup. For now [`Landing.astro`](src/components/Landing.astro)
is only the nav and one placeholder section. Build each section as the
feature it describes lands in delocal. Keep the layout below, and replace
the copy with what is true at the time.

1. **Nav**
   - 100px tall, with a full-width bottom rule.
   - Left: the mark and the 24px wordmark.
   - Right: links at 15px in `--text-2`, 36px apart, then the amber
     "$ install" button. The button waits for a release.
2. **Hero** (rule below)
   - **Left:** status pill; h1 (four lines in the mockup); 21px lede, about
     540px wide; install box across the full column; a 14px `--faint` note
     below.
   - **Right:** a terminal window, vertically centred. The install box and
     the install command wait for a release.
3. **Explainer** (rule below)
   - **Left:** a `--surface` card holding the same orbit art as the holding
     page, with a mono caption at the bottom.
   - **Right:** h2, then three points. Each point has a 10px dot in a
     machine colour (cyan, amber, violet), an 18px `--ink` title and 16px
     `--text-2` body text.
4. **Safety** (rule below)
   - **Left:** h2; lede; a list of mono terms (`trash` rose, `hold` amber,
     `revert` cyan), each next to a one-line description.
   - **Right:** a terminal window.
5. **Getting started**
   - h2 across the full width.
   - Two cards side by side, 24px apart. Each card has a mono step label
     and a `--terminal` code box with an amber `$`.
   - A line of body text under the cards, with an underlined link to the
     docs.
6. **Follow the build**
   - A large panel (radius 28, `--raised`), with no rule above it.
   - **Left:** h2, a line of text and an amber "Watch on GitHub" button.
   - **Right:** space for art. The mockup shows a dashed placeholder box.
7. **Footer**
   - Rule above.
   - Left: a small mark and one line of `--muted` text.
   - Right: links to Docs and GitHub.

The mockup's captions "Final art: a Gemini illustration in this palette" and
"[ART: …]" are notes to the designer, not copy.

## Open questions

- **Machine colours used for other things.** The mockup uses them for
  things that aren't machines: the terminal prompt path in cyan, `hold`
  amber, `revert` cyan, and the step labels in cyan and violet. Keep them,
  or move those to neutral colours so the machine colours only ever mean
  machines?
- **Mockup copy.** It makes claims the code may not make yet, such as "No
  accounts, no config file", trash/hold/revert, and "a full mesh". Each one
  needs to be true in delocal before its section ships.
