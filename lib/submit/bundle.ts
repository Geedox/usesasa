import { build } from "esbuild";
import path from "node:path";

// Bundle the shared extension fill engine into a single browser-injectable IIFE
// that exposes `window.__sasaFill = fillAndSubmit`. We reuse the EXACT same DOM
// logic the Chrome extension uses (react-select handling, résumé attach, the
// autofill-skip fix, post-submit verification) — just injected into a headless
// page instead of a content script. Built once and cached for the worker's life.
let cached: string | null = null;

export async function getFillBundle(): Promise<string> {
  if (cached) return cached;
  const entry = path.join(process.cwd(), "lib/submit/fill-entry.ts");
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "chrome120",
    write: false,
    minify: false,
    legalComments: "none",
  });
  cached = result.outputFiles[0].text;
  return cached;
}
