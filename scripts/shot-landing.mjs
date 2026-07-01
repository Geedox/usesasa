import { chromium } from "playwright";
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })).newPage();
await p.goto("https://usesasa.xyz", { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
const offsets = [0, 820, 1680, 2600];
for (let i = 0; i < offsets.length; i++) {
  await p.evaluate((y) => window.scrollTo(0, y), offsets[i]);
  await p.waitForTimeout(800);
  await p.screenshot({ path: `store-assets/landing-${i + 1}.jpg`, type: "jpeg", quality: 92, clip: { x: 0, y: 0, width: 1280, height: 800 } });
  console.log("wrote store-assets/landing-" + (i + 1) + ".jpg");
}
await b.close();
