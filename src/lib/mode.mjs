// Resolves which site a build produces, from environment variables:
//
//   SITE_MODE  holding | full         default: PRODUCTION_MODE in site.config.mjs
//   SITE_ENV   production | preview   default: production
//
// Unset or empty means the default. Any other value throws, so a typo fails
// the build instead of silently producing the wrong site.
import { PRODUCTION_MODE } from "../../site.config.mjs";

export const SITE_MODES = ["holding", "full"];
export const SITE_ENVS = ["production", "preview"];

function oneOf(name, value, allowed) {
  if (!allowed.includes(value)) {
    throw new Error(`${name} is "${value}", expected one of: ${allowed.join(", ")}`);
  }
  return value;
}

export function resolveMode(env = process.env) {
  const fallback = oneOf("PRODUCTION_MODE in site.config.mjs", PRODUCTION_MODE, SITE_MODES);
  return {
    siteMode: env.SITE_MODE ? oneOf("SITE_MODE", env.SITE_MODE, SITE_MODES) : fallback,
    siteEnv: env.SITE_ENV ? oneOf("SITE_ENV", env.SITE_ENV, SITE_ENVS) : "production",
  };
}
