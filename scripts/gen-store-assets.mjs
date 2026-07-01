// Generates the Chrome Web Store listing assets + the extension toolbar icons.
//   node scripts/gen-store-assets.mjs
// Store screenshots / promo tiles are emitted as JPEG (the store requires "no alpha",
// which JPEG guarantees). The 128px store icon + toolbar icons are PNG.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const FG = "#14110d"; // warm near-black (foreground)
const BG = "#faf9f6"; // warm off-white (background)
const MUT = "#6f685c"; // muted text
const BORD = "#e7e2d8"; // hairline border
const CARD = "#ffffff";

const STORE = "store-assets";
mkdirSync(STORE, { recursive: true });
mkdirSync("extension/public/icon", { recursive: true });

// ── shared bits ────────────────────────────────────────────────────────────
// The brand mark: an "↗" arrow drawn as strokes.
const glyph = (size, color = FG) => `<svg width="${size}" height="${size}" viewBox="0 0 512 512" fill="none">
  <g stroke="${color}" stroke-width="52" stroke-linecap="round" stroke-linejoin="round">
    <path d="M150 350 L330 170"/><path d="M252 170 L330 170 L330 248"/>
  </g></svg>`;

// The dark rounded tile (used for icons + as a lockup badge).
const tile = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 512 512" fill="none">
  <rect x="16" y="16" width="480" height="480" rx="116" fill="${FG}"/>
  <g stroke="${BG}" stroke-width="46" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M180 332 L320 192"/><path d="M256 192 L320 192 L320 256"/></g></svg>`;

const lockup = (tilepx = 40, textpx = 30) => `
  <div style="display:flex;align-items:center;gap:14px">
    <div style="width:${tilepx}px;height:${tilepx}px;display:flex">${tile(tilepx)}</div>
    <span style="font-family:'Instrument Serif',serif;font-size:${textpx}px;letter-spacing:-.5px">Sasa</span>
  </div>`;

const kicker = (t) => `<span style="font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${MUT}">${t}</span>`;

// A ring showing a match %.
const ring = (pct, d = 64) => {
  const r = d / 2 - 5, c = 2 * Math.PI * r;
  return `<div style="position:relative;width:${d}px;height:${d}px;flex:none">
    <svg width="${d}" height="${d}" style="transform:rotate(-90deg)">
      <circle cx="${d / 2}" cy="${d / 2}" r="${r}" stroke="${BORD}" stroke-width="6" fill="none"/>
      <circle cx="${d / 2}" cy="${d / 2}" r="${r}" stroke="${FG}" stroke-width="6" fill="none"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}"/>
    </svg>
    <span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Instrument Sans';font-weight:600;font-size:${d * 0.24}px">${pct}%</span>
  </div>`;
};

// The floating Sasa widget card that sits on a job page.
const widget = ({ pct = 92, title = "Senior Frontend Engineer", company = "Vercel", state = "ready" } = {}) => `
  <div style="width:340px;background:${CARD};border:1px solid ${BORD};border-radius:18px;box-shadow:0 24px 60px -20px rgba(20,17,13,.28);overflow:hidden">
    <div style="display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid ${BORD}">
      <div style="width:26px;height:26px;display:flex">${tile(26)}</div>
      <span style="font-family:'Instrument Serif',serif;font-size:19px">Sasa</span>
      <span style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:1.5px;color:${MUT};text-transform:uppercase">Match</span>
      ${ring(pct, 44)}
    </div>
    <div style="padding:16px">
      <div style="font-family:'Instrument Sans';font-weight:600;font-size:16px;line-height:1.25">${title}</div>
      <div style="font-family:'Instrument Sans';font-size:13px;color:${MUT};margin-top:2px">${company} · Remote</div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <div style="flex:1;text-align:center;padding:11px 0;border:1px solid ${BORD};border-radius:11px;font-family:'Instrument Sans';font-weight:600;font-size:13px">Quick fill</div>
        <div style="flex:1;text-align:center;padding:11px 0;background:${FG};color:${BG};border-radius:11px;font-family:'Instrument Sans';font-weight:600;font-size:13px">Tailor &amp; queue</div>
      </div>
      <div style="display:flex;align-items:center;gap:7px;margin-top:14px;font-family:'Instrument Sans';font-size:12px;color:${MUT}">
        <span style="width:7px;height:7px;border-radius:50%;background:#16a34a;flex:none"></span>
        ${state === "ready" ? "Profile matched · ready to fill" : "Queued · you approve before it sends"}
      </div>
    </div>
  </div>`;

// A minimal browser chrome wrapper for a "page behind the widget" look.
const browserFrame = (inner, { url = "boards.greenhouse.io/vercel", w = 720, h = 470 } = {}) => `
  <div style="width:${w}px;height:${h}px;background:${CARD};border:1px solid ${BORD};border-radius:16px;overflow:hidden;box-shadow:0 30px 80px -30px rgba(20,17,13,.30)">
    <div style="height:42px;display:flex;align-items:center;gap:8px;padding:0 16px;border-bottom:1px solid ${BORD};background:#fbfaf7">
      <span style="width:11px;height:11px;border-radius:50%;background:#e5e1d8"></span>
      <span style="width:11px;height:11px;border-radius:50%;background:#e5e1d8"></span>
      <span style="width:11px;height:11px;border-radius:50%;background:#e5e1d8"></span>
      <div style="margin-left:12px;flex:1;height:24px;border-radius:7px;background:${BG};border:1px solid ${BORD};display:flex;align-items:center;padding:0 12px;font-family:'JetBrains Mono',monospace;font-size:11px;color:${MUT}">${url}</div>
    </div>
    <div style="padding:26px 28px;position:relative;height:calc(100% - 42px);box-sizing:border-box">${inner}</div>
  </div>`;

const formField = (label, value, done = true) => `
  <div style="margin-bottom:13px">
    <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${MUT};margin-bottom:5px">${label}</div>
    <div style="height:36px;border:1px solid ${done ? "#c9e6cf" : BORD};background:${done ? "#f2fbf4" : CARD};border-radius:9px;display:flex;align-items:center;padding:0 12px;font-family:'Instrument Sans';font-size:13px;gap:8px">
      ${done ? `<span style="color:#16a34a;font-size:13px">✓</span>` : ""}<span>${value}</span>
    </div>
  </div>`;

// ── page wrapper ───────────────────────────────────────────────────────────
const page = (w, h, inner, { pad = 0, bg = BG } = {}) => `<!doctype html><html><head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>*{margin:0;padding:0;box-sizing:border-box}</style></head>
  <body style="width:${w}px;height:${h}px;background:${bg};color:${FG};padding:${pad}px;overflow:hidden;
    font-family:'Instrument Sans',system-ui,sans-serif;
    background-image:radial-gradient(${FG}0d 1px,transparent 1px);background-size:22px 22px">
    ${inner}</body></html>`;

const caption = (kick, head, sub) => `
  <div style="text-align:center;max-width:900px;margin:0 auto 30px">
    ${kicker(kick)}
    <h1 style="font-family:'Instrument Serif',serif;font-size:46px;line-height:1.05;letter-spacing:-1px;margin:12px 0 10px">${head}</h1>
    <p style="font-family:'Instrument Sans';font-size:17px;color:${MUT};line-height:1.5">${sub}</p>
  </div>`;

// ── the five screenshots (1280×800) ────────────────────────────────────────
const shots = [
  // 1 — hero
  page(1280, 800, `
    <div style="height:100%;display:flex;flex-direction:column;justify-content:center;padding:56px 64px">
      ${caption("Autopilot for applications", "Apply to jobs, hands off.", "Sasa fills, tailors and queues applications from your own browser. You approve, it sends.")}
      <div style="position:relative;display:flex;justify-content:center;align-items:center;margin-top:8px">
        ${browserFrame(`
          ${kicker("boards.greenhouse.io")}
          <h2 style="font-family:'Instrument Serif',serif;font-size:30px;margin:10px 0 6px">Senior Frontend Engineer</h2>
          <p style="font-family:'Instrument Sans';font-size:14px;color:${MUT};max-width:420px;line-height:1.6">We're looking for a product-minded engineer to shape the next generation of our developer platform. React, TypeScript, edge rendering.</p>
          <div style="display:flex;gap:8px;margin-top:18px">
            <span style="font-family:'JetBrains Mono';font-size:11px;border:1px solid ${BORD};border-radius:20px;padding:5px 12px;color:${MUT}">Remote</span>
            <span style="font-family:'JetBrains Mono';font-size:11px;border:1px solid ${BORD};border-radius:20px;padding:5px 12px;color:${MUT}">Full-time</span>
            <span style="font-family:'JetBrains Mono';font-size:11px;border:1px solid ${BORD};border-radius:20px;padding:5px 12px;color:${MUT}">$140k to $180k</span>
          </div>`, { w: 720, h: 340 })}
        <div style="position:absolute;right:150px;bottom:-40px">${widget()}</div>
      </div>
    </div>`),

  // 2 — one click fills the form
  page(1280, 800, `
    <div style="height:100%;display:flex;flex-direction:column;justify-content:center;padding:56px 64px">
      ${caption("Universal autofill", "One click fills the whole form.", "Name, contact, work history, and the tricky screening questions, filled from your profile on any career page.")}
      <div style="position:relative;display:flex;justify-content:center">
        ${browserFrame(`
          <div style="display:flex;gap:26px">
            <div style="flex:1">
              ${formField("Full name", "Ada Okoye")}
              ${formField("Email", "ada@okoye.dev")}
              ${formField("Phone", "+234 801 234 5678")}
              ${formField("LinkedIn", "linkedin.com/in/adaokoye")}
            </div>
            <div style="flex:1">
              ${formField("Years of experience", "6")}
              ${formField("Work authorization", "Authorized to work remotely")}
              ${formField("Why this role?", "Drafted from your profile ↴", false)}
              <div style="height:52px;border:1px solid #c9e6cf;background:#f2fbf4;border-radius:9px;padding:9px 12px;font-family:'Instrument Sans';font-size:12px;line-height:1.5;color:${FG}">I've shipped edge-rendered React apps at scale and want to help developers build faster…</div>
            </div>
          </div>`, { w: 780, h: 430, url: "jobs.lever.co/apply" })}
        <div style="position:absolute;right:120px;bottom:-34px">${widget({ pct: 88, state: "ready" })}</div>
      </div>
    </div>`),

  // 3 — tailored + human approves
  page(1280, 800, `
    <div style="height:100%;display:flex;flex-direction:column;justify-content:center;padding:56px 100px">
      ${caption("You always approve", "Tailored CV and cover letter, queued for your OK.", "Sasa rewrites your CV and drafts a cover letter for each role, then waits. Nothing is ever sent without you.")}
      <div style="display:flex;gap:22px;justify-content:center;align-items:stretch;margin-top:6px">
        <div style="width:420px;background:${CARD};border:1px solid ${BORD};border-radius:16px;padding:24px;box-shadow:0 24px 60px -28px rgba(20,17,13,.25)">
          ${kicker("Tailored CV · match 92%")}
          <div style="margin-top:14px;font-family:'Instrument Serif',serif;font-size:22px">Ada Okoye</div>
          <div style="font-family:'Instrument Sans';font-size:12px;color:${MUT};margin-bottom:14px">Frontend Engineer</div>
          ${["Rebuilt checkout with React + edge SSR, cut TTFB 40%","Led design system used by 30+ engineers","TypeScript · Next.js · Performance"].map(l => `<div style="display:flex;gap:8px;font-family:'Instrument Sans';font-size:13px;color:${FG};margin-bottom:9px;line-height:1.4"><span style="color:#16a34a">✓</span>${l}</div>`).join("")}
        </div>
        <div style="width:420px;display:flex;flex-direction:column;gap:16px">
          <div style="background:${CARD};border:1px solid ${BORD};border-radius:16px;padding:22px">
            ${kicker("Cover letter · drafted")}
            <p style="font-family:'Instrument Sans';font-size:13px;line-height:1.6;color:${FG};margin-top:12px">Dear Vercel team, your work on the edge is exactly where I've spent the last three years. At Paystack I…</p>
          </div>
          <div style="background:${FG};color:${BG};border-radius:16px;padding:22px;display:flex;align-items:center;gap:16px">
            <div style="flex:1">
              <div style="font-family:'Instrument Serif',serif;font-size:20px">Queued, waiting for you</div>
              <div style="font-family:'Instrument Sans';font-size:13px;opacity:.7;margin-top:2px">Review, edit, then approve to submit.</div>
            </div>
            <div style="background:${BG};color:${FG};border-radius:10px;padding:11px 16px;font-family:'Instrument Sans';font-weight:600;font-size:13px;white-space:nowrap">Approve &amp; send</div>
          </div>
        </div>
      </div>
    </div>`),

  // 4 — track everything
  page(1280, 800, `
    <div style="height:100%;display:flex;flex-direction:column;justify-content:center;padding:56px 90px">
      ${caption("One dashboard", "Track every application in one place.", "Top matches, drafts, queued, and submitted, with credits and status at a glance.")}
      <div style="background:${CARD};border:1px solid ${BORD};border-radius:18px;overflow:hidden;box-shadow:0 30px 80px -34px rgba(20,17,13,.28);max-width:1000px;margin:0 auto;width:100%">
        <div style="display:flex;align-items:center;gap:20px;padding:18px 24px;border-bottom:1px solid ${BORD}">
          ${lockup(30, 22)}
          <div style="display:flex;gap:6px;margin-left:14px">
            <span style="font-family:'Instrument Sans';font-weight:600;font-size:13px;background:${FG};color:${BG};padding:7px 14px;border-radius:9px">Top matches</span>
            <span style="font-family:'Instrument Sans';font-size:13px;color:${MUT};padding:7px 14px;border-radius:9px">Applications</span>
          </div>
          <span style="margin-left:auto;font-family:'JetBrains Mono';font-size:12px;border:1px solid ${BORD};border-radius:20px;padding:7px 14px">◆ 18 credits</span>
        </div>
        ${[["Senior Frontend Engineer", "Vercel", 92, "Queued", "#14110d", "#faf9f6"],
    ["Product Engineer", "Linear", 88, "Submitted", "#eef7f0", "#166534"],
    ["Full-stack Developer", "Paystack", 84, "Tailoring", "#f4f0e8", "#6f685c"],
    ["Frontend Engineer", "Flutterwave", 81, "Draft", "#f4f0e8", "#6f685c"]]
    .map(([role, co, m, st, bg, fg]) => `
          <div style="display:flex;align-items:center;gap:18px;padding:16px 24px;border-bottom:1px solid ${BORD}">
            ${ring(m, 46)}
            <div style="flex:1">
              <div style="font-family:'Instrument Sans';font-weight:600;font-size:15px">${role}</div>
              <div style="font-family:'Instrument Sans';font-size:13px;color:${MUT}">${co} · Remote</div>
            </div>
            <span style="font-family:'Instrument Sans';font-weight:500;font-size:12px;background:${bg};color:${fg};padding:6px 14px;border-radius:20px">${st}</span>
          </div>`).join("")}
      </div>
    </div>`),

  // 5 — works everywhere
  page(1280, 800, `
    <div style="height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:56px 64px">
      ${caption("Every board", "Works on the sites you already apply on.", "Greenhouse, Lever, Ashby, Workday, and any other career page on the web.")}
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:18px;max-width:920px;width:100%;margin-top:8px">
        ${["Greenhouse", "Lever", "Ashby", "Workday", "Remotive", "The Muse", "Arbeitnow", "+ any page"]
      .map(n => `<div style="background:${CARD};border:1px solid ${BORD};border-radius:14px;height:96px;display:flex;align-items:center;justify-content:center;font-family:'Instrument Serif',serif;font-size:22px;color:${FG}">${n}</div>`).join("")}
      </div>
      <div style="margin-top:34px">${lockup(34, 26)}</div>
    </div>`),
];

// ── promo tiles ────────────────────────────────────────────────────────────
const promoSmall = page(440, 280, `
  <div style="height:100%;display:flex;flex-direction:column;justify-content:center;padding:34px">
    ${lockup(38, 30)}
    <h1 style="font-family:'Instrument Serif',serif;font-size:34px;line-height:1.05;letter-spacing:-.5px;margin:20px 0 8px">Apply to jobs,<br>hands off.</h1>
    <p style="font-family:'Instrument Sans';font-size:13px;color:${MUT};line-height:1.5">Fills, tailors and queues from your browser. You approve, it sends.</p>
  </div>`);

const promoMarquee = page(1400, 560, `
  <div style="height:100%;display:flex;align-items:center;padding:0 72px;gap:48px">
    <div style="flex:1">
      ${lockup(48, 38)}
      <h1 style="font-family:'Instrument Serif',serif;font-size:68px;line-height:1;letter-spacing:-2px;margin:28px 0 18px">Apply to jobs,<br>hands off.</h1>
      <p style="font-family:'Instrument Sans';font-size:20px;color:${MUT};line-height:1.5;max-width:520px">Sasa fills, tailors and queues applications from your own browser. Nothing is sent until you approve.</p>
    </div>
    <div style="flex:none;transform:rotate(2deg)">${widget()}</div>
  </div>`);

// ── render ─────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
const pg = await ctx.newPage();

async function shoot(html, w, h, out, jpeg = true) {
  await pg.setViewportSize({ width: w, height: h });
  await pg.setContent(html, { waitUntil: "networkidle" });
  await pg.evaluate(() => document.fonts.ready);
  await pg.screenshot({
    path: out,
    clip: { x: 0, y: 0, width: w, height: h },
    ...(jpeg ? { type: "jpeg", quality: 92 } : { type: "png" }),
  });
  console.log("wrote", out);
}

// Store icon 128 (PNG) + extension toolbar icons (PNG, transparent tile)
async function icon(size, out, transparent = false) {
  await pg.setViewportSize({ width: size, height: size });
  await pg.setContent(`<body style="margin:0">${tile(size)}</body>`, { waitUntil: "load" });
  await pg.screenshot({ path: out, omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size }, type: "png" });
  console.log("wrote", out);
}

for (let i = 0; i < shots.length; i++) await shoot(shots[i], 1280, 800, `${STORE}/screenshot-${i + 1}.jpg`);
await shoot(promoSmall, 440, 280, `${STORE}/promo-small-440x280.jpg`);
await shoot(promoMarquee, 1400, 560, `${STORE}/promo-marquee-1400x560.jpg`);
await icon(128, `${STORE}/store-icon-128.png`, false);
for (const s of [16, 32, 48, 96, 128]) await icon(s, `extension/public/icon/${s}.png`, true);

await browser.close();
console.log("\nDone. Store assets in ./store-assets, toolbar icons in ./extension/public/icon");
