import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { defineCollection } from "astro:content";
import { resolveMode } from "./lib/mode.mjs";

// Holding builds define no collections, so no docs data is loaded at all.
export const collections =
  resolveMode().siteMode === "full"
    ? { docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }) }
    : {};
