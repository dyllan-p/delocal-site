# Launching delocal.sh

Everything the launch PR must do, in order. Launching switches production
from the holding page to the full site: the landing page and the docs.

Read [CLAUDE.md](CLAUDE.md) and [DESIGN.md](DESIGN.md) first. As with every
PR, post a short plan and wait for Dyllan's go, open one PR, and stop. Dyllan
merges, and merging is what deploys.

## Before starting

- **A release.** [delocal](https://github.com/dyllan-p/delocal) must have a
  first release, with `install.sh` among its assets. Without one there is
  nothing true to launch.
- **Record the commit.** Note the delocal release tag and commit you check
  the copy against, and put both in the PR description.
- **List what's left.** `SITE_MODE=full npx astro build --outDir dist-full`
  fails and names every placeholder and illustrative example. On 2026-09-27
  it listed 97 problems:
  - 95 placeholders: 18 on the landing page and 77 across the nine docs
    pages;
  - the two terminals on the landing page.

  The launch is ready when that build passes.

## 1. Copy

Replace every placeholder with real copy, and check each sentence, line by
line, against the delocal repo at the recorded commit: its README, docs,
`--help` output and code. Claim nothing it doesn't do.

- **The landing page**
  ([`Landing.astro`](src/components/Landing.astro)):
  - the headline, lede, requirements note, section headings, properties,
    safety terms, step 2 and the closing band;
  - the meta description, the `description` passed to `Base`, which is also
    `og:description`.
- **The docs** ([`src/content/docs/docs/`](src/content/docs/docs/)):
  - every `<p class="ph">` line;
  - every `## [Placeholder heading: …]`. Real headings get new ids, so check
    links to them;
  - every `[Placeholder command: …]` line, which becomes a real command in a
    code block, with real output copied from delocal;
  - each page's `description` in its frontmatter.
- **Copy that is real today but won't be at launch:**
  - the status pill, "In development, no releases yet";
  - step 1's label, if the install steps change;
  - README.md, CLAUDE.md and DESIGN.md, which all say there are no releases.
- **Placeholder sizes.** Remove the landing page's `min-height` rules for
  placeholder boxes, such as `.hero-heading` and `.points .ph`. Then compare
  the page with `design/mockup.pdf` again: the section heights are a target
  again once real copy is in.
- **Keep the guards.** Keep `placeholder.css`, the placeholder-heading
  styles in `starlight.css` and the build's placeholder check. They cost
  nothing and catch a placeholder that slips back in.
- **Latin-only copy.** The pages load only Fontsource's Latin font files.
  The build also ships the other subsets (Latin Extended, Cyrillic, Greek,
  Vietnamese), but browsers only download one when a page uses its
  characters. Some symbols aren't in any subset, and render in a system
  font. So check the real copy uses only Latin characters. After a full
  build:

  ```sh
  LC_ALL=C.UTF-8 grep -rhoP '[^\x{0000}-\x{00FF}\x{0131}\x{0152}\x{0153}\x{02BB}\x{02BC}\x{02C6}\x{02DA}\x{02DC}\x{0304}\x{0308}\x{0329}\x{2000}-\x{206F}\x{20AC}\x{2122}\x{2191}\x{2193}\x{2212}\x{2215}\x{FEFF}\x{FFFD}]' --include='*.html' dist-full | sort | uniq -c
  ```

  The class is Fontsource's Latin `unicode-range`. On 2026-09-27 it found:
  - ❯ ✓ ● ■, in the illustrative terminals;
  - ⌘, in Starlight's search shortcut.

  Anything new in the copy either gets rewritten or is a deliberate choice,
  noted in the PR.

## 2. Terminals

The landing page has two illustrative terminals, `heroTerminal` (`delocal
up`) and `safetyTerminal` (`delocal status` with held deletes), in
`Landing.astro`.

- **Real sessions.** Replace each with a real session from the release:
  - Run the commands and copy the output exactly, columns included.
  - Name the machines laptop, desk and nas, so the colour rule holds:
    laptop cyan, desk violet, nas rose. If the real hostnames differ, map
    them.
  - If delocal can't produce a session yet, remove the terminal instead.
- **Terminal.astro.** Once no example is invented:
  - remove the "illustrative" tag, `data-illustrative`, and the
    "Illustrative example:" prefix on the aria-label;
  - update the Terminal window section of DESIGN.md to match.

## 3. The installer

- **Replace the stub.** Replace [`install/install.sh`](install/install.sh)
  with `install.sh` from the release, byte for byte.
- **The build's checks.** The build hook checks that the script starts with
  `#!/bin/sh`, contains no HTML and passes `sh -n`.
- **Truncated downloads.** Check the real script also keeps everything in a
  function called on its last line, so a cut-off download runs nothing. If
  it doesn't, raise it with Dyllan before launch.
- **Decide how it stays in sync** with delocal's releases, and record the
  decision in README.md's "How /install works". Some options:
  - Copy it by hand at each release, with a CI check that fails when it
    differs from the latest release's asset.
  - Run a scheduled workflow that opens a PR when a release's `install.sh`
    changes.
  - Fetch it at build time. That makes builds depend on GitHub, and on which
    release is latest when the build runs.

  Redirecting `/install` to GitHub is out: `check-install.sh` allows at most
  one redirect, ending on `https://…/install`, served as `text/plain`.
- **`--run` would install delocal.** `check-install.sh --run` pipes the
  script into `sh`. Today that runs the stub. With the real installer it
  would install delocal on:
  - the CI runner;
  - the machine running the smoke test;
  - anyone following "Verifying" in CLAUDE.md.

  Before launch, decide whether `--run` stays (only if the installer has a
  dry run, for example an environment variable) or goes. Update
  `check.yml`, `smoke-test.sh`, CLAUDE.md and README.md to match.

## 4. The share image and art

- **Alt text.** Check that `og:image:alt` and `twitter:image:alt`, in
  [`share-image.mjs`](src/lib/share-image.mjs), still describe the picture.
- **The art.** Check `og.png` and the closing art against the final copy.
  For example, the art shows three machines with amber light between them.
  If the copy no longer tells that story, the art may need to change.
- **New art** goes through [`art/README.md`](art/README.md) and
  `scripts/compose-art.mjs`. It needs `GEMINI_API_KEY`: never print it, log
  it, write it to a file or put it on a command line.

## 5. Flip the mode

- **The flip.** In [`site.config.mjs`](site.config.mjs), change
  `PRODUCTION_MODE` from `"holding"` to `"full"`. That is the only change
  deploys need: the deploy build sets no `SITE_MODE` or `SITE_ENV`.
- **CI's check job.** It serves the holding build (`SITE_MODE=holding`) to
  `check-install.sh` and `check-site.sh`, so after launch it would stop
  checking what ships. Change it to serve a production build of the full
  site. Keep the step name and the job's id and name, `check`.
- **The holding page.** Decide with Dyllan whether to keep it and holding
  mode:
  - Keeping it makes going back one line. But its copy says there is
    nothing to install, which will be false, so it would need new copy
    first.
  - Deleting it means removing holding mode from `mode.mjs`,
    `astro.config.mjs`, the build hooks, README.md and CLAUDE.md.
- **Docs in the same PR.**
  - CLAUDE.md: the rules that only hold until launch (the holding page only,
    placeholders, illustrative examples) and "Build modes".
  - README.md: "Build modes", "Launching" and the intro.
  - DESIGN.md: the Copy notes under Landing page and Docs, and anything the
    real copy changed.
  - This file: delete it once the launch has shipped.

## 6. Checks

- **Locally,** before opening the PR, run every check under "Verifying" in
  CLAUDE.md, minding `--run` (step 3):
  - `SITE_MODE=full npx astro build` must now pass;
  - with `PRODUCTION_MODE` set to `"full"`, a plain build is the full site.
    Serve it with `wrangler dev`, then run `check-site.sh` and
    `check-install.sh` against it.
- **Audits.** Repeat PR 7's audits on the full site:
  - no sideways scroll at 360, 390, 768 and 1024;
  - 44x44 targets with touch emulation at 390, and 24x24 without it at 1440;
  - no text under 14px, apart from the exceptions in DESIGN.md;
  - keyboard: skip link, amber focus rings, tab order, no traps;
  - nothing moves with `prefers-reduced-motion: reduce`;
  - axe on every page type at 1440 and 390.
- **On the preview** (the PR's `pr-<number>` link):
  - The `preview` job runs the smoke test. Check that it passed.
  - Read every page there once, at phone and desktop widths, including docs
    search.
- **After merge,** the `deploy` job smoke-tests https://delocal.sh and
  checks the workers.dev copy is noindex. Then check by hand:
  - `sh scripts/check-site.sh https://delocal.sh`, and `check-install.sh`
    (with `--run` only if step 3 kept it);
  - `https://delocal.sh/robots.txt` allows crawling, and pages have no
    noindex;
  - `curl -fsSL https://delocal.sh/install | sh` does what the docs say, on
    a machine where installing delocal is fine;
  - the 404 page, docs search, and the share image when a link is pasted
    somewhere.
- **Zone features.** Cloudflare zone features can change pages at the edge
  (Web Analytics, Rocket Loader, email obfuscation, Zaraz). Keep them off
  for delocal.sh. `check-site.sh` is what enforces it. After launch it
  checks `/docs/` too, because the landing page links there. Check that the
  deploy's smoke test and the next daily `edge` run both show it.
- **Rolling back:** see README.md. A rollback lasts until the next push to
  `main`.
