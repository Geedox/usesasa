import { defineConfig } from "wxt";

export default defineConfig({
  // The Next app runs on 3000; keep WXT's dev/HMR server off it.
  dev: {
    server: { port: 3001 },
  },
  // Manifest is a function so the localhost host permission is only added to dev
  // builds. Production (pnpm build / pnpm zip) ships https only, which keeps the
  // Web Store review clean.
  manifest: ({ mode }) => ({
    name: "Sasa",
    description: "Apply to jobs, hands off. Submits your queued applications from your own browser.",
    permissions: ["storage", "tabs", "scripting", "alarms", "webNavigation"],
    // Broad host access so the universal autofill widget can detect and prefill a
    // job form on any career page on the web (the Tsenta-style flow).
    host_permissions:
      mode === "development" ? ["https://*/*", "http://localhost:3000/*"] : ["https://*/*"],
  }),
});
