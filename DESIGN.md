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
- **Terminal examples are tagged "illustrative"**, in the title bar, and
  carry `data-illustrative`. A production build fails while any element has
  it, as it does for placeholders.
- **No** stats, logos, testimonials or FAQ.
- **Dark only.** No light theme, no toggle, no `prefers-color-scheme`
  queries, no `data-theme` script. `:root` has `color-scheme: dark`.
- **Everything self-hosted.** No fonts, scripts or images from another host.
  The build fails if a page or stylesheet loads one.

## Colour

| Token          | Value     | Use                                                        |
| -------------- | --------- | ---------------------------------------------------------- |
| `--bg`         | `#14152a` | Page background. Text on amber buttons.                    |
| `--surface`    | `#181a33` | Cards: the art card and the step cards.                    |
| `--raised`     | `#1d1f3d` | Large panels (the closing band), the Copy button.          |
| `--terminal`   | `#0e0f20` | Terminal windows, the install box, code boxes.             |
| `--rule`       | `#2a2c4a` | 1px section rules, terminal and install box borders.       |
| `--rule-strong`| `#3a3c62` | Pill borders, dashed orbits, dashed placeholder boxes, terminal title-bar dots, the "illustrative" tag. |
| `--ink`        | `#eceaf4` | Headings, the wordmark, line-drawn icons.                  |
| `--text-2`     | `#c3c4dc` | Body text, ledes, nav links.                               |
| `--muted`      | `#a4a6c4` | Secondary text, art particles.                             |
| `--faint`      | `#8d8fb0` | Notes, captions, terminal timestamps, placeholders.        |
| `--amber`      | `#f5b947` | delocal itself and anything asking you to act. See below.  |
| `--cyan`       | `#5fd4e6` | Machine colour: laptop. The logo's left dot.               |
| `--violet`     | `#b39bff` | Machine colour: desk. The logo's right dot.                |
| `--rose`       | `#ff8fa3` | Machine colour: nas.                                       |
| `--green`      | `#7ee2a8` | Success only, such as the terminal's `✓`.                  |

### The colour rule

Each colour has one job:

- **Amber** is delocal itself and anything asking you to act: the logo's
  centre dot, buttons (with `--bg` text), the `$` and `❯` prompts, and a
  held change waiting for approval. Link underlines, focus rings and the
  status dot are amber too.
- **Cyan, violet and rose** are machines in examples, one each: laptop
  cyan, desk violet, nas rose. Amber never stands for a machine. Use the
  tokens `--laptop`, `--desk` and `--nas` when the colour means a machine,
  in terminals and in the orbit art.
- **Green** is success only.
- **Everything else** is `--ink`, `--text-2`, `--muted` or `--faint`:
  paths like `~/Sync`, step labels and numbers, terms, bullet dots,
  terminal title-bar dots and the "illustrative" tag.

The logo mark keeps cyan, amber and violet. There the outer dots are places
and the amber centre is the file spread across them, so it uses `--cyan`,
`--amber` and `--violet`, not the machine tokens.

This changes the mockup, where desk was amber, nas violet, and the prompt
path, the safety terms, the step labels, the property bullets, the
title-bar dots and the "illustrative" tag used machine colours.

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

**Logo mark.** Three dots on a 44×16 grid, all on `cy=8`. The outer dots
are places and the amber centre is the file spread across them (see
[The colour rule](#the-colour-rule)):

- cyan `r4.5` at `cx=4.5`
- amber `r5.5` at `cx=22`
- violet `r4.5` at `cx=39.5`

The outer dots touch the grid edges. It is
[`Mark.astro`](src/components/Mark.astro), `public/favicon.svg` and
`src/assets/mark.svg` (the Starlight logo). It shows at 44px in the nav, 32px in
the landing page's footer, and 50px next to the holding page's wordmark.

**Wordmark.** "delocal" in lower case, set as described under
[Type](#type), 14–18px after the mark. It is 24px in the nav and 56px on the
holding page.

**Status pill.** 1px `--rule-strong` border, fully round, an 8px amber dot,
then 14–16px `--text-2` text.

**Buttons.** `--amber` background, `--bg` text, radius 10, JetBrains Mono
15px. The nav's "$ install" button is 44px tall and "Watch on GitHub" 48px.

**Install box.** [`InstallCommand.astro`](src/components/InstallCommand.astro).
`--terminal` background, 1px `--rule` border, radius 12, 60px tall. Inside:
an amber `$`, the command in JetBrains Mono 16px, and a "Copy" button on
the right (`--raised`, radius 8).

- **The command** is always `curl -fsSL https://delocal.sh/install | sh`,
  built from `SITE_URL`. When it is wider than the box, it scrolls sideways
  inside it.
- **The Copy button** is the page's only script. It copies with
  `navigator.clipboard` and shows "Copied" on the button and in an
  aria-live region for two seconds. If clipboard access fails, it selects
  the command instead.
- **Without JavaScript** the button never shows: it is rendered `hidden`
  and the script reveals it. The command has `user-select: all`, so one
  click selects it.
- **The plain variant**, in Get started, has no Copy button and no visible
  border, with radius 10, 52px tall.

**Terminal window.** [`Terminal.astro`](src/components/Terminal.astro).
- **Frame:** `--terminal` background, 1px `--rule` border, radius 16.
- **Title bar:** about 50px tall with a `--rule` bottom border. On the left,
  three 10px `--rule-strong` dots. In the centre, the title (for example
  `~/Sync`) in `--faint`. On the right, the "illustrative" tag:
  `--rule-strong` background, `--ink` text, JetBrains Mono 12px, radius 4.
  The title bar is hidden from screen readers.
- **Body:** a `<pre>` with 26px padding, JetBrains Mono 15px on 26px lines.
  Its aria-label starts "Illustrative example:". When it is too wide, it
  scrolls sideways inside its own box, never the page, and it is focusable
  so it can be scrolled from the keyboard.
- **Colours**, by the colour rule:
  - amber: the `❯` prompt and a held change;
  - `--muted`: the path;
  - `--ink`: commands;
  - `--faint`: labels and timestamps;
  - machine colours: machine names;
  - green: the `✓`.
- **Illustrative:** the `<pre>` has `data-illustrative`, so a production
  build fails while any terminal remains. The error names each one by its
  aria-label.
- **Alignment:** use fixed-width columns (`white-space: pre`, or a grid
  sized in `ch`). The mockup's hero terminal has overlapping columns
  ("uptailnet", "filespeers"). That is a rendering fault, not the design.

**Cards.** `--surface` background, radius 16, no border.

**Large panel.** `--raised` background, radius 28, about 72px padding.

**Placeholders.** `.ph` in
[`src/styles/placeholder.css`](src/styles/placeholder.css): a dashed
`--rule-strong` box, radius 16, `--faint` JetBrains Mono 14px.

- **Headings:** it can sit on a heading, `<h2 class="ph">`, which keeps the
  page outline and the section labels.
- **Text:** the text names what goes there, such as `[Placeholder heading:
  the safety promise]`.
- **Size:** on the landing page, each box's minimum height matches the
  copy it stands in for, so the page keeps the mockup's proportions.

## Motion

None, except what answers a click, such as a "Copied" state on the Copy
button. There is no transition on hover or scroll, and nothing animates on
load. `prefers-reduced-motion: reduce` turns off any animation and
transition.

## Implementation notes

- **OrbitArt.** [`OrbitArt.astro`](src/components/OrbitArt.astro) is the
  orbit art on both pages. It takes a required `id`, such as `holding` or
  `how`, made of lower-case letters, digits and hyphens. The id names its
  gradients, so the output is the same every time. Two copies on one page
  need different ids, and the build fails if they share one.
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

[`src/components/Holding.astro`](src/components/Holding.astro), with the
shared [`OrbitArt.astro`](src/components/OrbitArt.astro). Page 3 of the
mockup.
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
  - Three radial glows of radius 100, fading from 0.55 opacity to 0, in the
    machine colours: cyan behind the laptop (left), violet behind the
    desktop (right), rose behind the server (bottom). The mockup has amber
    and violet for the last two, from before the colour rule.
  - Thin (1.5px) `--ink` line-drawn machine icons.
  - A scatter of small `--muted` particles.
  - A white (`--ink`) centre dot ringed in amber.
- **Under 900px:** one column, text first, art below.

In the mockup the violet glow is clipped at the bottom. That is a mockup
fault; the build draws the whole glow.

## Landing page (full mode)

Page 1 of the mockup, built in
[`Landing.astro`](src/components/Landing.astro).

**Copy.** Real copy is only for facts true today:

- the status pill, "In development, no releases yet";
- the install command, always `https://delocal.sh/install`;
- the installer's real output;
- repo links and nav labels;
- the footer's line on the name.

Everything that describes what delocal does is a placeholder. That covers
the headline, lede, section headings, properties, safety terms, step 2 and
the closing band. Terminals keep invented output and are illustrative.

**Sections**, in order:

1. **Nav**
   - 100px tall, with a full-width bottom rule.
   - Left: the mark and the 24px wordmark.
   - Right: How it works, Safety, Docs and GitHub at 15px in `--text-2`,
     36px apart, then the amber "$ install" button. The button jumps to
     Get started (`#install`).
   - Under 900px the links move to a second row. There is no menu script.
2. **Hero** (rule below), with 104px above.
   - **Left:**
     - status pill at 15px;
     - h1 placeholder, four lines;
     - lede placeholder, three lines and 540px wide;
     - install box with Copy;
     - the requirements note, as a one-line placeholder.
   - **Right:** a terminal running `delocal up`, vertically centred.
3. **How it works** (`#how-it-works`, rule below)
   - **Left:** a `--surface` card, radius 16, holding the orbit art
     (`id="how"`). The mockup's caption under the art is a note to the
     designer, so it is left out.
   - **Right:** h2 placeholder (four lines), then three properties, 28px
     apart. Each is a 10px `--muted` dot and a placeholder.
   - Under 900px the text comes first and the art below.
4. **Safety** (`#safety`, rule below)
   - **Left:** h2 placeholder (two lines), lede placeholder, then three
     placeholders for the terms.
   - **Right:** a terminal running `delocal status`, with a held change.
5. **Get started** (`#install`)
   - h2 placeholder across the full width.
   - Two `--surface` cards, 24px apart:
     - step 1 has the mono label "1 Install" in `--muted` and the plain
       install box;
     - step 2 has its number and a placeholder.
   - A one-line placeholder under the cards, for a line that links to the
     docs.
6. **Closing band**
   - A large panel (radius 28, `--raised`, 72px padding), 108px below Get
     started, with no rule above it.
   - **Left:** h2 placeholder, a two-line placeholder, and the amber
     "Watch on GitHub" button, linking to the repo.
   - **Right:** the art slot, a `.ph` box 270px tall.
7. **Footer**
   - Rule above.
   - Left: a 32px mark and "delocal, named after a particle spread across
     many positions at once." in `--muted`.
   - Right: links to Docs and GitHub.

Two-column sections stack under 900px.

**Accessibility:**

- There is one h1, and each section is labelled by its heading
  (`aria-labelledby`).
- Terminals are `<pre>` elements with an aria-label. The orbit art is
  `aria-hidden`.
- Focus rings are amber, from the global `:focus-visible` rule.
- Everything is reachable by keyboard, including the boxes that scroll
  sideways.

The mockup's captions "Final art: a Gemini illustration in this palette" and
"[ART: …]" are notes to the designer, not copy.

## Decisions

Dyllan resolved these on 2026-09-26:

1. **Colour.** Each colour has one job. See
   [The colour rule](#the-colour-rule).
2. **Copy.** Placeholders stay until launch. The launch PR includes a
   line-by-line review of every sentence against the main repo,
   [delocal](https://github.com/dyllan-p/delocal).
