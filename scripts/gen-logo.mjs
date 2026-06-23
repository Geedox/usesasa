import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const tileSvg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 512 512">
  <rect x="16" y="16" width="480" height="480" rx="116" fill="#14110d"/>
  <g stroke="#faf9f6" stroke-width="46" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M180 332 L320 192"/><path d="M256 192 L320 192 L320 256"/>
  </g>
</svg>`;
const glyphSvg = (s, color) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 512 512">
  <g stroke="${color}" stroke-width="52" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M150 350 L330 170"/><path d="M252 170 L330 170 L330 248"/>
  </g>
</svg>`;

writeFileSync("public/logo.svg", tileSvg(512));
writeFileSync("public/logo-glyph.svg", glyphSvg(512, "#14110d"));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
async function render(svg, size, out, transparent) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0;padding:0">${svg}</body>`, { waitUntil: "load" });
  await page.screenshot({ path: `public/${out}`, omitBackground: !!transparent, clip: { x: 0, y: 0, width: size, height: size } });
  console.log("wrote public/" + out, `${size}x${size}`);
}
for (const [name, size] of [["logo.png",1024],["logo-512.png",512],["apple-touch-icon.png",180],["icon-192.png",192],["favicon.png",48]])
  await render(tileSvg(size), size, name, true);
await render(glyphSvg(512, "#14110d"), 512, "logo-glyph.png", true);
await browser.close();
