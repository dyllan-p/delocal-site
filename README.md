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
  response and `Disallow: /` to `robots.txt`. Production builds add it only
  on the workers.dev copy. See [Headers and indexing](#headers-and-indexing).

A **production full build fails** while any page still has placeholder copy
(`class="ph"` or the text `[Placeholder`) or an illustrative example
(`data-illustrative`, which the terminal examples carry). The error names
each one. That stops the site launching half-written.

## Running locally

| Command                      | What it does                                                  |
| ---------------------------- | ------------------------------------------------------------- |
| `npm run dev`                | Dev server for the holding page, at http://localhost:4321     |
| `npm run dev:full`           | Dev server for the full site                                  |
| `npm run build`              | Holding production build into `dist/`                         |
| `npm run build:full`         | Full preview build into `dist-full/`                          |
| `SITE_MODE=full npm run build` | Full production build. Fails until the placeholders are gone. |
| `npm run preview`            | Serves `dist/` with `wrangler dev` at http://localhost:8787, the way Workers will. Build first. |

Astro caches rendered Markdown in `node_modules/.astro`. After changing the
Expressive Code settings in `astro.config.mjs` or `src/lib/ec-theme.mjs`,
delete that directory before building. Otherwise docs pages can link to a
code-block stylesheet that no longer exists. CI always starts without the
cache.

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
  whose paths overlap, including `/*`. The build fails if one is.
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

## Headers and indexing

The build hook writes every header into `dist/_headers`:

- **Security headers** on every response, in every environment:
  `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
  `Permissions-Policy` and `Strict-Transport-Security: max-age=31536000`.
  - HSTS has no `includeSubDomains`, because subdomains may come later.
  - It has no `preload`, because preload is hard to undo.
  - Keep HSTS off at the zone level in the Cloudflare dashboard (SSL/TLS →
    Edge Certificates). Otherwise the header is sent twice.
  - http:// already redirects to https://, through the zone's "Always Use
    HTTPS" setting. That lives in the dashboard, not in this repo.
- **The workers.dev copy.** Production is also served at the Worker's
  workers.dev address, `delocal-site.<account subdomain>.workers.dev`.
  - A production build gives that host `X-Robots-Tag: noindex, nofollow`,
    with the rule `https://delocal-site.:subdomain.workers.dev/*`.
  - A host placeholder matches exactly one DNS label. So the rule matches
    neither delocal.sh nor the version and preview hosts, which are
    `<version or alias>-delocal-site.<account subdomain>.workers.dev`.
  - Preview builds set the header in `/*` instead.
  - On version and preview URLs, Cloudflare sets its own
    `X-Robots-Tag: noindex` in place of ours. So previews show `noindex`,
    not `noindex, nofollow`. We keep our own header in case Cloudflare
    stops.
  - workers.dev serves plain http without redirecting. "Always Use HTTPS"
    only covers the delocal.sh zone. Browsers use https anyway, because
    `.dev` is on the HSTS preload list.
- **Canonical links.** Every page has a
  `<link rel="canonical">` to `https://delocal.sh` plus its path, in both
  modes. Starlight adds its own on docs pages.
  - The 404 page has none, and has `<meta name="robots" content="noindex">`
    instead.
  - That page is served at every unknown path, and at `/404` itself with
    status 200.

## Other build checks

After every build, the build hook also checks:

- A holding build has only `index.html` and `404.html` as pages, and no
  `pagefind/` directory.
- A full build has `docs/index.html`.
- No two `OrbitArt` illustrations on one page share an id.
- No page or stylesheet loads a script, stylesheet, font or image from
  another host.
- Every page except `404.html` has exactly one canonical link, to its
  address on delocal.sh, and no robots noindex meta tag. `404.html` has the
  noindex meta tag and no canonical link.
- No header in `_headers` is set twice in one rule, or in two rules whose
  URL patterns overlap.

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
2. It runs `wrangler deploy`, and reads the workers.dev URL from wrangler's
   list of deploy targets.
3. It smoke-tests https://delocal.sh, and checks that the workers.dev URL is
   noindex.

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
  - each security header appears exactly once, with the expected value.
    `Strict-Transport-Security` is only checked on https URLs, because
    browsers ignore it over http;
  - an unknown path returns the 404 page, which has a robots noindex meta
    tag;
  - `_headers` is not served;
  - robots rules match the environment:
    - A production build must be indexable. `/` has no `X-Robots-Tag` or
      robots meta tag saying noindex, and `robots.txt` allows crawling.
    - A preview (`--preview`) must have at least one `X-Robots-Tag` saying
      noindex, and `Disallow: /`.
  - with `--workers-dev <url>`, that URL has at least one `X-Robots-Tag`
    saying noindex. The deploy job passes the workers.dev URL.

  The noindex checks test the outcome, not the header count or value.
  Cloudflare replaces `X-Robots-Tag` on version and preview URLs. The build
  check on `_headers` covers what we control.
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

1. **Write the real copy.** Replace every placeholder with it, and every
   illustrative terminal with real output, or remove it. Review every
   sentence, line by line, against delocal at that point. `SITE_MODE=full
   npm run build` must pass locally.
2. **Open a PR** that changes `PRODUCTION_MODE` in
   [`site.config.mjs`](site.config.mjs) from `"holding"` to `"full"`.
3. **Merge it** once `check` is green. The `deploy` job ships it.

## Layout

```
astro.config.mjs        Astro config: routes / by mode; Starlight is added only in full mode
site.config.mjs         PRODUCTION_MODE, REPO_URL, SITE_URL
wrangler.jsonc          Workers static assets config (no Worker code)
install/install.sh      the script served at /install
scripts/check-install.sh
scripts/check-site.sh   checks a served site: home page, headers, robots rules, 404, workers.dev
scripts/smoke-test.sh   check-site and check-install against a deploy, with retries
src/lib/mode.mjs        resolves SITE_MODE and SITE_ENV
src/lib/build-hooks.mjs publishes /install, writes _headers and robots.txt, checks the output
src/lib/ec-theme.mjs    the code-block colours for the docs (Expressive Code)
src/pages/              404 (astro.config.mjs routes / to Holding or Landing)
src/components/         Holding, Landing, OrbitArt, Terminal, InstallCommand, Mark, Starlight overrides
src/content/docs/docs/  docs pages (full mode), served under /docs/; the sidebar is in astro.config.mjs
src/styles/             fonts, tokens, global, placeholder and Starlight styles
design/mockup.pdf       the design reference; see DESIGN.md
```

## Licence

[MIT](LICENSE)
