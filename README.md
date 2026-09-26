# delocal-site

The website for [delocal](https://github.com/dyllan-p/delocal), served at
[delocal.sh](https://delocal.sh). delocal is a file sync tool for Linux and
macOS that runs over Tailscale. It is still in development and has no
releases.

The site is built with [Astro](https://astro.build), with
[Starlight](https://starlight.astro.build) for the docs. It is served by
Cloudflare Workers static assets. Until launch, the public site is only a
holding page.

## Requirements

- Node 22.12 or later
- npm

```sh
npm ci
```

## Build modes

Two environment variables choose what a build produces. Unset means the
default. Any other value fails the build.

| Variable    | Values                    | Default                                   |
| ----------- | ------------------------- | ----------------------------------------- |
| `SITE_MODE` | `holding`, `full`         | `PRODUCTION_MODE` in `site.config.mjs`, currently `holding` |
| `SITE_ENV`  | `production`, `preview`   | `production`                              |

- **Holding** is one page, `/`, plus the 404 page and `/install`. Starlight
  isn't added, so there are no docs pages, no docs data and no search
  index.
- **Full** is the landing page and the Starlight docs under `/docs/`. Most
  of it is placeholder copy for now.
- **Preview** builds add `X-Robots-Tag: noindex, nofollow` to every
  response and `Disallow: /` to `robots.txt`.

A **production full build fails** while any page still has placeholder copy
(`class="ph"` or the text `[Placeholder`). That stops the site launching
half-written.

## Running locally

| Command                      | What it does                                                  |
| ---------------------------- | ------------------------------------------------------------- |
| `npm run dev`                | Dev server for the holding page, at http://localhost:4321     |
| `npm run dev:full`           | Dev server for the full site                                  |
| `npm run build`              | Holding production build into `dist/`                         |
| `npm run build:full`         | Full preview build into `dist-full/`                          |
| `SITE_MODE=full npm run build` | Full production build. Fails until the placeholders are gone. |
| `npm run preview`            | Serves `dist/` with `wrangler dev` at http://localhost:8787, the way Workers will. Build first. |

To check the local server the way CI does:

```sh
npm run build
npm run preview        # in another terminal
sh scripts/check-install.sh http://127.0.0.1:8787 --local --run
sh scripts/check-site.sh http://127.0.0.1:8787
```

## How /install works

`curl -fsSL https://delocal.sh/install | sh` fetches
[`install/install.sh`](install/install.sh):

- **The script.** It is POSIX sh, and everything runs inside `main()`,
  which is called on the last line. A download cut off part way through
  therefore runs nothing. For now it only prints that there is nothing to
  install. It will be replaced by `install.sh` from delocal's releases.
- **Publishing it.** [`src/lib/build-hooks.mjs`](src/lib/build-hooks.mjs)
  runs after every build. It checks that the script starts with
  `#!/bin/sh`, has no HTML and passes `sh -n`, and that no page, endpoint or
  public file already claims `/install`. Then it copies the script to
  `dist/install`. The file has no extension, so no pretty-URL or
  trailing-slash handling applies to it. Don't put it in `public/`.
- **Headers.** The same hook writes `dist/_headers`, which serves
  `/install` as `text/plain; charset=utf-8` with
  `Cache-Control: public, max-age=300`.
- **Headers to watch.** Workers applies every `_headers` rule that matches a
  path and joins the values. So never set the same header in two rules
  whose paths overlap, including `/*`.
- **Checking a server.**
  [`scripts/check-install.sh`](scripts/check-install.sh) checks a running
  server:

  ```sh
  sh scripts/check-install.sh https://delocal.sh           # a deployed site
  sh scripts/check-install.sh http://127.0.0.1:8787 --local # wrangler dev
  ```

  It checks for:
  - status 200;
  - at most one redirect, ending on `https://…/install` (`--local` allows
    `http://`);
  - `Content-Type: text/plain`;
  - exactly one `Cache-Control` header, with `max-age` at most 600;
  - a body that starts with `#!/bin/sh`, has no `<html` or `<!doctype`, and
    passes `sh -n`.

  With `--run` it also pipes the script into `sh`, but only if every check
  passed. It exits non-zero on any failure.

## Other build checks

After every build, the build hook also checks:

- A holding build has only `index.html` and `404.html` as pages, and no
  `pagefind/` directory.
- A full build has `docs/index.html`.
- No page or stylesheet loads a script, stylesheet, font or image from
  another host.

## CI and deploys

[`.github/workflows/check.yml`](.github/workflows/check.yml) has three jobs.

**`check`** runs on every pull request and on every push to `main`. `main`
requires it to pass. It:

1. builds the holding site and the full preview;
2. serves the holding build with `wrangler dev`;
3. runs `check-install.sh --local --run` and `check-site.sh` against it.

**`deploy`** runs on pushes to `main`, once `check` has passed. That means
every merged PR deploys:

1. It builds with no `SITE_MODE` or `SITE_ENV`, so `PRODUCTION_MODE`
   decides what ships.
2. It runs `wrangler deploy`.
3. It smoke-tests https://delocal.sh.

Only one deploy runs at a time. A second push waits for the first to finish.

**`preview`** runs on pull requests from branches in this repo, once
`check` has passed. Forks get no secrets, so they get no preview. It:

1. builds the full site with `SITE_ENV=preview`;
2. uploads it as a new Worker version with
   `wrangler versions upload --preview-alias pr-<number>`;
3. smoke-tests it.

The PR shows the preview URL as a "View deployment" link, and the job
summary shows it too. A preview never changes production. Preview URLs are
public but noindex.

### Smoke tests

[`scripts/smoke-test.sh`](scripts/smoke-test.sh) runs two checks against a
deployed site:

- [`scripts/check-site.sh`](scripts/check-site.sh):
  - `/` returns 200 HTML;
  - each security header appears exactly once;
  - an unknown path returns the 404 page;
  - `_headers` is not served;
  - robots rules match the environment. A production build must be
    indexable, and a preview (`--preview`) must be noindex with
    `Disallow: /`.
- `check-install.sh --run`, with the full https and redirect checks.

It retries for up to 10 minutes (`SMOKE_TIMEOUT`), because the first deploy
has to provision the custom domain and its certificate.

### Secrets

These are repository secrets:

- `CLOUDFLARE_API_TOKEN`: a token made from Cloudflare's "Edit Cloudflare
  Workers" template, covering the account and the `delocal.sh` zone.
- `CLOUDFLARE_ACCOUNT_ID`.

### The first deploy

The first push to `main` with the `deploy` job creates:

- the Worker `delocal-site`;
- its workers.dev address;
- the custom domain `delocal.sh`, with its DNS record and certificate.

Two things must already be true:

- **workers.dev subdomain:** the Cloudflare account must have one
  registered. If it doesn't, wrangler stops with a link to register it in
  the dashboard. Register it, then re-run the job.
- **DNS:** the `delocal.sh` zone must be on the same account, with no DNS
  record of its own for `delocal.sh`. The Worker's custom domain creates
  that record.

The `preview` job can't upload a version until the Worker exists, so a PR
opened before the first deploy passes with a notice and no preview.

### Rolling back

```sh
npx wrangler rollback              # back to the previous version
npx wrangler deployments list      # to pick a specific one
```

These need `wrangler login` or the API token. Alternatively, use the Worker's
Deployments tab in the Cloudflare dashboard.

A rollback lasts until the next push to `main` deploys again. Fix `main`
with a PR soon after rolling back.

## Launching

Launching means switching the production build from the holding page to the
full site:

1. **Write the real copy.** Replace every placeholder with it, and make sure
   each claim is true in delocal at that point. `SITE_MODE=full npm run
   build` must pass locally.
2. **Open a PR** that changes `PRODUCTION_MODE` in
   [`site.config.mjs`](site.config.mjs) from `"holding"` to `"full"`.
3. **Merge it** once `check` is green. The `deploy` job ships it.

## Layout

```
astro.config.mjs        Astro config; Starlight is added only in full mode
site.config.mjs         PRODUCTION_MODE, REPO_URL, SITE_URL
wrangler.jsonc          Workers static assets config (no Worker code)
install/install.sh      the script served at /install
scripts/check-install.sh
scripts/check-site.sh   checks a served site: home page, headers, robots rules, 404
scripts/smoke-test.sh   check-site and check-install against a deploy, with retries
src/lib/mode.mjs        resolves SITE_MODE and SITE_ENV
src/lib/build-hooks.mjs publishes /install, writes _headers and robots.txt, checks the output
src/pages/              index (holding or landing, by mode) and 404
src/components/         Holding, HoldingArt, Landing, Mark, Starlight overrides
src/content/docs/docs/  docs pages (full mode), served under /docs/
src/styles/             fonts, tokens, global, placeholder and Starlight styles
design/mockup.pdf       the design reference; see DESIGN.md
```

## Licence

[MIT](LICENSE)
