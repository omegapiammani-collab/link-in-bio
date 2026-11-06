import { bindings, defineConfig, defineWorker } from "cf/config";

// Only the isolated test Workers Builds environment supplies these values.
// Never commit credentials or use the Phase 1 project's values here.
// The CI fixtures may omit bindings; the deploy preflight fails closed unless
// every exact Phase 2 staging value is present before an actual upload.
const stagingEnvKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "OWNER_AUTH_USER_ID",
  "PHASE2_EXPECTED_ORIGIN",
  "PHASE2_PAGE_LIST_ENABLED",
] as const;

const stagingBindings = Object.fromEntries(
  stagingEnvKeys.map((key) => [
    key,
    process.env[key] ? bindings.text(process.env[key]) : undefined,
  ]),
);

export default defineConfig({
  worker: defineWorker({
    name: "link-in-bio-phase2-preview",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-04",
    compatibilityFlags: ["nodejs_compat"],
    previewUrls: false,
    observability: { enabled: true, logs: { enabled: true } },
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
      ...stagingBindings,
    },
  }),
});
