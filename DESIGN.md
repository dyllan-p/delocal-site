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
[`Mark.astro`](src/components/Mark.astro) and `public/favicon.svg`. It shows at
44px in the nav and the docs header (36px there under 800px), 32px in the
landing page's footer, 50px next to the holding page's wordmark, 132px in the
home-screen icon, and about 103px in the share image (see [Art](#art)).

**Icons.** Every page links two:
- `public/favicon.svg`, the mark on a transparent square;
- `public/apple-touch-icon.png`, the home-screen icon: the mark 132px wide,
  centred on `--bg` at 180x180, with no transparency, since iOS fills it with
  black. [`touch-icon.mjs`](scripts/touch-icon.mjs) makes it from
  `favicon.svg` and the `--bg` token, so never edit it by hand. The build
  checks its size and that every page links it.

**Wordmark.** "delocal" in lower case, set as described under
[Type](#type), 14–18px after the mark. It is 24px in the nav (20px in the docs
header under 800px), and 56px on the holding page and in the share image.

**Status pill.** 1px `--rule-strong` border, fully round, an 8px amber dot,
then 14–16px `--text-2` text.

**Buttons.** `--amber` background, `--bg` text, radius 10, JetBrains Mono
15px. The nav's "$ install" button is 44px tall and "Watch on GitHub" 48px.

**Install box.** [`InstallCommand.astro`](src/components/InstallCommand.astro).
`--terminal` background, 1px `--rule` border, radius 12, 60px tall. Inside:
an amber `$`, the command in JetBrains Mono 16px, and a "Copy" button on
the right (`--raised`, radius 8, 44px tall).

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
- **Padding:** every placeholder has the same inner padding, 16px 20px,
  whatever it stands in for.
- **Size:** on the landing page, the multi-line boxes keep a minimum height
  from the copy they stand in for. The mockup's section heights are not a
  target while placeholders stand: a one-line box is taller than a line of
  copy, so sections run taller than in the mockup. Real copy sets the heights
  at launch.

## Motion

None, except what answers a click, such as a "Copied" state on the Copy
button. There is no transition on hover or scroll, and nothing animates on
load. `prefers-reduced-motion: reduce` turns off any animation and
transition.

In the docs, the only motion is Starlight's sidebar caret, which turns when a
group opens or closes. It answers a click.

## Accessibility

These hold on every page, in both modes.

- **Skip link.** Every page starts with a "Skip to content" link, hidden until
  it has focus. It shows at the top left: amber with `--bg` text, radius 10,
  44px tall.
  - On our own pages it is in [`Base.astro`](src/layouts/Base.astro) and
    jumps to `<main id="main">`.
  - Starlight has its own, styled to match.
- **Focus.** Everything focusable gets a 2px amber outline, 3px out, from the
  global `:focus-visible` rule. A wrapper that clips, such as the docs site
  title's, leaves room for it.
- **Targets.**
  - On touch screens (`pointer: coarse`), every link and button is at least
    44x44px.
  - With a fine pointer the minimum is 24x24 (WCAG 2.2 AA, 2.5.8), so the docs
    sidebar and "On this page" keep their density.
  - Both Copy buttons are 44px tall everywhere.
  - A negative margin, or padding on an inline link, grows a target without
    moving anything around it.
- **Text.** Nothing is smaller than 14px, except the terminal's title (13px)
  and "illustrative" tag (12px). In the docs that covers Starlight's two
  smallest sizes and Pagefind's search results.
- **Motion.** See [Motion](#motion).

## Art

The site has two illustrations, both AI-generated with Google's Gemini:
- the closing band's art, on the landing page;
- the share image, `/og.png`.

[`art/README.md`](art/README.md) records how each was made and how to make
more. Everywhere else the art is OrbitArt.

**Style.**
- A 1980s computer-magazine illustration of a night-time desk, printed in a
  few flat inks with halftone dots and a little paper grain.
- Cream machines drawn in off-white (`--ink`) line work, on the background
  token.
- No text, letters, numbers or anything letter-like, no logos or Apple
  shapes, and no people.

**Colour.** The colour rule holds in the art:
- the laptop glows cyan, the desktop violet and the home server rose, as the
  machines are coloured in the terminals;
- amber is only the cloud of light drifting between them, the one thing
  present on all three machines.

**Edges.** The art has no frame. Its edges fall off to the page, and
[`compose-art.mjs`](scripts/compose-art.mjs) feathers them into the exact
token colour, so no seam shows.

**Closing art.** [`src/assets/closing-art.png`](src/assets/closing-art.png),
1056x528.
- **Size:** it fills the closing band's right column at 2:1. That is 528x264
  at 1440, and the full column width under 900px.
- **Formats:** `<Picture>` serves AVIF and WebP at 528 and 1056 wide, at
  quality 80. Lower smears the halftone dots.
- **Loading:** it is lazy-loaded, and its width and height are set so the
  layout doesn't shift.
- **Alt text:** it is decorative, with `alt=""`.
- **Size limit:** the build fails if any image the site serves is over
  150 KB.

**Share image.** [`public/og.png`](public/og.png), 1200x630.
- **Size limit:** 300 KB or less. The build checks both the size and the
  dimensions.
- **Art:** the same desk as the closing art, scaled into x 580–1160 and
  aligned right, so the left 45% stays calm.
- **Mark and wordmark:** on the left at x 80, vertically centred, in the
  nav's proportions: a 44px mark and a 16px gap beside a 24px wordmark.
  Here that is a 56px wordmark.
  - They are vector outlines, never drawn by the model.
  - The image has no other words.
- **Tags:** every page has one `og:image`, and the build checks it. Every
  page carries these, from
  [`src/lib/share-image.mjs`](src/lib/share-image.mjs):
  - `og:image` and `twitter:image`, both `https://delocal.sh/og.png`;
  - `og:image:width` and `og:image:height`;
  - `og:image:alt` and `twitter:image:alt`, which describe the picture. Keep
    them in step with the art.
- **Other tags:** on our own pages, Base.astro also adds:
  - `og:title`;
  - `og:description`, which repeats the meta description, so the production
    guard catches a placeholder in either;
  - `og:url`, left off the noindex 404 page;
  - `og:type` as `website`, and `og:site_name` as `delocal`;
  - `twitter:card` as `summary_large_image`.

  On docs pages, Starlight adds its own versions of these, with `og:type` as
  `article`.

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

  How the docs look is under [Docs](#docs-full-mode).

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
   - **Right:** the closing art, 528x264 at 1440. See [Art](#art).
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
"[ART: …]" are notes to the designer, not copy. The art they asked for is
described under [Art](#art).

## Docs (full mode)

Starlight, under `/docs/`, themed so it reads as the same site as the landing
page. The pages are Markdown in
[`src/content/docs/docs/`](src/content/docs/docs/), and the sidebar is set in
[`astro.config.mjs`](astro.config.mjs):

- **Start:** Introduction (`/docs/`), Install, Quick start
- **Concepts:** How sync works, Safety, Tailscale
- **Reference:** Commands, Files and folders, Troubleshooting

**Copy.** The same rule as the landing page: page titles and sidebar labels
name topics, so they are real, and so are structural headings such as
Requirements and Uninstall.

- Everything else is a placeholder: prose, headings, and each page's meta
  description.
- The only real command is the install command, in a code block on Install
  and Quick start.
- Where another command belongs, a line such as `[Placeholder command: the
  command that …]` names what it does. There is no invented command or
  output.

**Placeholder headings** are Markdown headings,
`## [Placeholder heading: …]`, so they keep their ids and appear under "On
this page". Their ids start with `placeholder-heading-`, and `starlight.css`
gives those the `.ph` look, as a full-width box with no anchor link.

**Header.** It is 100px tall from Starlight's breakpoint (800px) up, with a
full-width `--rule` bottom rule, as on the landing nav.
- **Left:** the 44px mark and 24px wordmark, linking to `/`. Then a short
  `--rule-strong` rule and "Docs" in 15px `--text-2`, linking to `/docs/`.
  This is the [`SiteTitle`](src/components/starlight/SiteTitle.astro)
  override.
- **Middle:** Starlight's search, as a `--surface` box with a `--rule`
  border and radius 10.
- **Right:** "GitHub" as a 15px text link, from the
  [`SocialIcons`](src/components/starlight/SocialIcons.astro) override.
- **Under 800px:** one 64px row, with the mark and wordmark, "Docs", a
  search icon and the menu button. GitHub moves into the menu.
  - The brand is 5/6 of its size there: a 36px mark, a 13px gap and a 20px
    wordmark, with 14px either side of the rule.
  - The row's gaps are 12px, so everything fits at 360px, even with 44px
    search and menu buttons on touch screens.

**Colour.** Backgrounds, rules and text use the tokens. By the colour rule,
amber is only:
- link underlines (link text is `--ink`);
- the current sidebar item's marker;
- focus rings;
- the skip link.

The current heading under "On this page" and search highlights stay neutral.

**Type.**
- **Headings:** Martian Mono at the heading settings. h1 is 40px, h2 28px,
  h3 21px, and h1 and h2 scale down with `clamp()` to 30px and 24px.
- **Body:** Atkinson Hyperlegible Next at 17px / 1.6.
- **Code:** JetBrains Mono at 15px on 24px lines.
- **Labels:** sidebar group labels and "On this page" are JetBrains Mono 14px
  in `--muted`, like the landing page's step labels.

**Sidebar.** Links are 15px `--text-2`. The current page has a quiet
`--surface` background and a 2px amber marker on its left, not a filled
block. On touch screens each row is 44px tall.

**Code blocks** (Expressive Code) look like the install box:
- `--terminal` background, a 1px `--rule` border and `--radius-install`
  corners, with no shadow and no title bar;
- a one-line block is 60px tall;
- syntax colours are only `--ink`, `--text-2`, `--muted` and `--faint`,
  from [`ec-theme.mjs`](src/lib/ec-theme.mjs), which holds hex copies of the
  tokens.

**The Copy button** is Expressive Code's own, restyled like InstallCommand's:
- "Copy" in JetBrains Mono 14px on `--raised`, radius 8, 44px tall, and
  always visible;
- after a click it reads "Copied", and Expressive Code announces "Copied!"
  in an aria-live region;
- the label goes back after 1.5 seconds, Expressive Code's timing, rather
  than InstallCommand's 2;
- without JavaScript it is hidden.

**Not shown:** no "Edit page" links and no last-updated dates.

## Decisions

Dyllan resolved these on 2026-09-26:

1. **Colour.** Each colour has one job. See
   [The colour rule](#the-colour-rule).
2. **Copy.** Placeholders stay until launch. The launch PR includes a
   line-by-line review of every sentence against the main repo,
   [delocal](https://github.com/dyllan-p/delocal).
