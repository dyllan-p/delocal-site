// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import { REPO_URL, SITE_URL } from "./site.config.mjs";
import buildHooks from "./src/lib/build-hooks.mjs";
import { resolveMode } from "./src/lib/mode.mjs";

const { siteMode, siteEnv } = resolveMode();

// Starlight (the docs) is only added in full mode, so holding builds have no
// docs pages, no docs data and no search index.
const docs = () =>
  starlight({
    title: "delocal",
    logo: { src: "./src/assets/mark.svg" },
    social: [{ icon: "github", label: "GitHub", href: REPO_URL }],
    // src/pages/404.astro serves both modes.
    disable404Route: true,
    customCss: [
      "./src/styles/fonts.css",
      "./src/styles/tokens.css",
      "./src/styles/placeholder.css",
      "./src/styles/starlight.css",
    ],
    // Dark only: no theme picker and no script that sets data-theme.
    components: {
      ThemeProvider: "./src/components/starlight/ThemeProvider.astro",
      ThemeSelect: "./src/components/starlight/ThemeSelect.astro",
    },
    expressiveCode: { themes: ["starlight-dark"] },
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
