// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import { SITE_URL } from "./site.config.mjs";
import buildHooks from "./src/lib/build-hooks.mjs";
import ecTheme from "./src/lib/ec-theme.mjs";
import { resolveMode } from "./src/lib/mode.mjs";
import { shareImageMeta } from "./src/lib/share-image.mjs";

const { siteMode, siteEnv } = resolveMode();

// Starlight (the docs) is only added in full mode, so holding builds have no
// docs pages, no docs data and no search index.
const docs = () =>
  starlight({
    title: "delocal",
    // src/pages/404.astro serves both modes.
    disable404Route: true,
    // Starlight already sets og:title, og:description, og:url and
    // twitter:card from each page. This adds the share image.
    head: shareImageMeta.map((attrs) => ({ tag: "meta", attrs })),
    // Pages live in src/content/docs/docs/, so they are served under /docs/.
    // No editLink or lastUpdated: there are no "Edit page" links or
    // last-updated dates.
    sidebar: [
      { label: "Start", items: ["docs", "docs/install", "docs/quick-start"] },
      {
        label: "Concepts",
        items: ["docs/concepts/how-sync-works", "docs/concepts/safety", "docs/concepts/tailscale"],
      },
      {
        label: "Reference",
        items: ["docs/reference/commands", "docs/reference/files-and-folders", "docs/reference/troubleshooting"],
      },
    ],
    customCss: [
      "./src/styles/fonts.css",
      "./src/styles/tokens.css",
      "./src/styles/placeholder.css",
      "./src/styles/starlight.css",
    ],
    components: {
      // The header: the mark and wordmark, "Docs", and a text GitHub link,
      // like the landing nav.
      SiteTitle: "./src/components/starlight/SiteTitle.astro",
      SocialIcons: "./src/components/starlight/SocialIcons.astro",
      // Dark only: no theme picker and no script that sets data-theme.
      ThemeProvider: "./src/components/starlight/ThemeProvider.astro",
      ThemeSelect: "./src/components/starlight/ThemeSelect.astro",
    },
    // Code blocks look like the install box. Their Copy button is restyled in
    // starlight.css.
    expressiveCode: {
      themes: [ecTheme],
      defaultProps: { frame: "code" },
      styleOverrides: {
        borderColor: "var(--rule)",
        // Expressive Code adds the border width to this, so the outer corner
        // is --radius-install, as on the install box.
        borderRadius: "calc(var(--radius-install) - 1px)",
        codeBackground: "var(--terminal)",
        codeFontFamily: "var(--font-code)",
        codeFontSize: "15px",
        codeLineHeight: "24px",
        codePaddingBlock: "17px",
        codePaddingInline: "20px",
        frames: { frameBoxShadowCssValue: "none" },
      },
    },
  });

// The home page is Holding or Landing, by mode. Only one is routed, so the
// other's styles stay out of the build: a page bundles the CSS of every
// component it imports, whether it renders it or not.
const home = () => ({
  name: "delocal:home",
  hooks: {
    "astro:config:setup": ({ injectRoute }) => {
      const page = siteMode === "full" ? "Landing" : "Holding";
      injectRoute({ pattern: "/", entrypoint: `./src/components/${page}.astro` });
    },
  },
});

export default defineConfig({
  site: SITE_URL,
  // Starlight turns on link prefetching by default, which adds a script to
  // every page. The landing page's only script is its Copy button.
  prefetch: false,
  integrations: [
    home(),
    ...(siteMode === "full" ? [docs()] : []),
    // Last, so its checks see the finished output.
    buildHooks({ siteMode, siteEnv }),
  ],
});
