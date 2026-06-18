import { defineConfig } from "wxt";

export default defineConfig({
  // The Next app runs on 3000; keep WXT's dev/HMR server off it.
  dev: {
    server: { port: 3001 },
  },
  manifest: {
    name: "Sasa",
    description: "Apply to jobs, hands off. Submits your queued applications from your own browser.",
    permissions: ["storage", "tabs", "scripting"],
    host_permissions: [
      "http://localhost:3000/*",
      "https://usesasa.xyz/*",
      "https://*.greenhouse.io/*",
      "https://*.lever.co/*",
      "https://*.ashbyhq.com/*",
      "https://res.cloudinary.com/*",
    ],
  },
});
