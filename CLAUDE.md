# CLAUDE.md

The website for delocal (https://github.com/dyllan-p/delocal), served at
delocal.sh. delocal is a CLI-only file sync tool for Linux and macOS that
requires Tailscale. It is still in development, with no releases. README.md
covers commands and structure.

**Read DESIGN.md before touching any page.** `design/mockup.pdf` is the
visual reference. Where the two disagree, DESIGN.md and the tokens win.

## Rules

- **Claim nothing the code doesn't yet do.**
  - Until launch, the public site is the holding page only.
  - All other pages carry placeholder copy, as
    `<p class="ph">[Placeholder: what goes here]</p>`.
  - In docs Markdown, placeholder headings are
    `## [Placeholder heading: …]`. The only real command in the docs is the
    install command; other commands are `.ph` lines naming what they do.
  - Terminal examples are tagged "illustrative" and carry
    `data-illustrative`.
  - No stats, logos, testimonials or FAQ.
- **Everything self-hosted.** No third-party fonts, scripts or images at
  runtime. The build fails if a page or stylesheet loads one from another
  host.
- **Dark only.**
  - No light theme, no toggle, no `prefers-color-scheme` queries, and no
    `data-theme` script. `:root` has `color-scheme: dark`.
  - Starlight's ThemeSelect and ThemeProvider are overridden with empty
    components. Keep it that way. SiteTitle and SocialIcons are overridden
    too, for the docs header (see "Docs" in DESIGN.md).
- **Exact versions.** They are pinned with npm `save-exact` (see `.npmrc`),
  and the lockfile is committed. Upgrade deliberately, in its own PR.

## PR workflow

- Branch from `main`, open one PR with `gh pr create`, then stop. Dyllan
  merges.
- `main` has a ruleset: changes go in through PRs only, and the status check
  `check` is required. The job in `.github/workflows/check.yml` must keep the
  id and name `check`.
- Before opening a PR, run both builds and `check-install.sh` against
  `wrangler dev` (see "Verifying" below).

## Deploys

- **Production** deploys only from CI. `deploy` runs on every push to
  `main` after `check`. Never run `wrangler deploy` by hand; merging a PR is
  how things ship.
- **The deploy build sets no `SITE_MODE` or `SITE_ENV`**, so
  `PRODUCTION_MODE` decides what ships. Keep it that way.
- **Previews:** `preview` uploads the full site with `SITE_ENV=preview`
  (noindex) as a Worker version with the alias `pr-<number>`. It only runs
  for PRs from branches in this repo.
- **Smoke tests:** `scripts/smoke-test.sh` runs `check-site.sh` and
  `check-install.sh` against each deploy and preview, retrying for up to
  10 minutes.
- **Secrets:** `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, as repo
  secrets.
- **Rollback:** see README.md.
- **workers.dev:** production is also served at the Worker's workers.dev
  address. A host-specific `_headers` rule makes it noindex, and the
  production smoke test checks it. See "Headers and indexing" in README.md.
- **HSTS** comes from `_headers`. Zone-level HSTS stays off in the
  dashboard, or the header is sent twice.

## Build modes

`site.config.mjs` exports `PRODUCTION_MODE` (`"holding"` until launch),
`REPO_URL` and `SITE_URL`. `src/lib/mode.mjs` resolves the mode:

- `SITE_MODE` is `holding` or `full`. It defaults to `PRODUCTION_MODE`, and
  any other value throws.
- `SITE_ENV` is `production` or `preview`. It defaults to `production`, and
  any other value throws.

With no env vars set, a build produces the holding page.

`/` is `src/components/Holding.astro` or `Landing.astro`, by mode.
`astro.config.mjs` injects the route for only one of them, because a page
bundles the CSS of every component it imports, rendered or not. So never
import `Landing` from anything the holding page uses.

In full mode:

- The Starlight integration is added, and `src/content.config.ts` defines
  the docs collection. In holding mode it exports `{}`.
- `src/pages/404.astro` serves both modes, because Starlight's 404 is
  disabled.
- Link prefetching is off (`prefetch: false`). Starlight would otherwise
  add its script to every page, and the landing page's only script is its
  Copy button.

`src/lib/build-hooks.mjs` runs on `astro:build:done`:

- **/install.** It checks `install/install.sh`, then copies it to
  `dist/install`. Never put it in `public/`.
- **Other files.** It writes `dist/_headers` and `dist/robots.txt`.
- **Output checks.** It fails the build when:
  - a holding build has pages besides `index.html` and `404.html`, or has a
    pagefind directory;
  - a full build lacks `docs/index.html`;
  - a production build has placeholders or `data-illustrative` elements
    (the error names each one);
  - two `OrbitArt` instances on one page share an id;
  - anything loads from another host;
  - a page other than `404.html` lacks exactly one canonical link to
    `SITE_URL` plus its path, or `404.html` isn't noindex;
  - `_headers` sets a header twice for any request.

Workers joins the values of every `_headers` rule that matches a path. So
never set one header in two rules whose paths overlap. `/*` overlaps
everything.

## Verifying

```sh
npm ci
SITE_MODE=holding npx astro build --outDir dist
SITE_MODE=full SITE_ENV=preview npx astro build --outDir dist-full
SITE_MODE=full npx astro build --outDir dist-full   # must fail while placeholders or illustrative examples remain
npx wrangler dev --port 8787 --ip 127.0.0.1         # serves dist/, in another terminal
sh scripts/check-install.sh http://127.0.0.1:8787 --local --run
sh scripts/check-site.sh http://127.0.0.1:8787
npx wrangler deploy --dry-run
```

Astro builds into the project directory tree. Don't point `--outDir` at
another filesystem, such as `/tmp` on some machines: Astro moves files into
place with `rename`, which fails across filesystems.
