import { execSync } from "node:child_process";

// Local dev installs a Chromium for any local Playwright submission testing. Production
// (Railway) submits via Steel's remote browser, so we skip the heavy download there to
// keep the web + worker deploys slim and fast.
//
// Override either way with PLAYWRIGHT_CHROMIUM=1 (force install) or =0 (force skip).
const force = process.env.PLAYWRIGHT_CHROMIUM;
const onRailway = !!(
  process.env.RAILWAY_ENVIRONMENT ||
  process.env.RAILWAY_SERVICE_ID ||
  process.env.RAILWAY_PROJECT_ID
);

const shouldInstall = force === "1" ? true : force === "0" ? false : !onRailway;

if (!shouldInstall) {
  console.log("postinstall: skipping Chromium download (Railway/Steel). Set PLAYWRIGHT_CHROMIUM=1 to force.");
  process.exit(0);
}

try {
  execSync("playwright install chromium", { stdio: "inherit" });
} catch {
  console.warn("postinstall: Chromium install failed; continuing (Steel is the prod path).");
}
