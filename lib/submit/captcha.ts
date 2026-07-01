// Provider-agnostic captcha solver for the cloud submitter. Supports 2Captcha
// (cheapest to start, ~$3 min) and CapSolver, auto-selected by whichever key is in
// the env. Without any key, captcha-protected forms fall back to needs_user.
//   - 2Captcha:  TWOCAPTCHA_API_KEY
//   - CapSolver: CAPSOLVER_API_KEY
const CAPSOLVER_BASE = "https://api.capsolver.com";
const TWOCAPTCHA_BASE = "https://2captcha.com";

type Kind = "hcaptcha" | "recaptcha";

function provider(): "twocaptcha" | "capsolver" | null {
  if (process.env.TWOCAPTCHA_API_KEY) return "twocaptcha";
  if (process.env.CAPSOLVER_API_KEY) return "capsolver";
  return null;
}

export function captchaEnabled(): boolean {
  return provider() !== null;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- 2Captcha (in.php / res.php) ---
async function twocaptcha(kind: Kind, sitekey: string, url: string): Promise<string | null> {
  const key = process.env.TWOCAPTCHA_API_KEY!;
  const method = kind === "hcaptcha" ? "hcaptcha" : "userrecaptcha";
  const params = new URLSearchParams({ key, method, sitekey, pageurl: url, json: "1" });
  if (kind === "recaptcha") { params.delete("sitekey"); params.set("googlekey", sitekey); }
  try {
    const inRes = await fetch(`${TWOCAPTCHA_BASE}/in.php`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params });
    const inJson = (await inRes.json()) as { status?: number; request?: string };
    if (inJson.status !== 1 || !inJson.request) { console.warn(`[captcha] 2captcha submit failed: ${inJson.request}`); return null; }
    const id = inJson.request;
    for (let i = 0; i < 40; i++) {
      await wait(3000);
      const res = await fetch(`${TWOCAPTCHA_BASE}/res.php?key=${key}&action=get&id=${id}&json=1`);
      const out = (await res.json()) as { status?: number; request?: string };
      if (out.status === 1) return out.request ?? null;
      if (out.request && out.request !== "CAPCHA_NOT_READY") { console.warn(`[captcha] 2captcha error: ${out.request}`); return null; }
    }
    console.warn("[captcha] 2captcha timed out");
    return null;
  } catch (err) {
    console.warn("[captcha] 2captcha error:", err);
    return null;
  }
}

// --- CapSolver (createTask / getTaskResult) ---
async function capsolverAwait(clientKey: string, taskId: string): Promise<string | null> {
  for (let i = 0; i < 40; i++) {
    await wait(3000);
    const res = await fetch(`${CAPSOLVER_BASE}/getTaskResult`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientKey, taskId }) });
    const out = (await res.json()) as { status?: string; solution?: { gRecaptchaResponse?: string; token?: string }; errorId?: number; errorDescription?: string };
    if (out.errorId) { console.warn(`[captcha] capsolver result error: ${out.errorDescription}`); return null; }
    if (out.status === "ready") return out.solution?.gRecaptchaResponse ?? out.solution?.token ?? null;
  }
  return null;
}
async function capsolver(kind: Kind, sitekey: string, url: string, enterprise: boolean): Promise<string | null> {
  const clientKey = process.env.CAPSOLVER_API_KEY!;
  const type = kind === "hcaptcha" ? "HCaptchaTaskProxyLess" : enterprise ? "ReCaptchaV2EnterpriseTaskProxyLess" : "ReCaptchaV2TaskProxyLess";
  try {
    const createRes = await fetch(`${CAPSOLVER_BASE}/createTask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientKey, task: { type, websiteURL: url, websiteKey: sitekey } }) });
    const created = (await createRes.json()) as { taskId?: string; errorId?: number; errorDescription?: string };
    if (created.errorId || !created.taskId) { console.warn(`[captcha] capsolver createTask failed: ${created.errorDescription}`); return null; }
    return await capsolverAwait(clientKey, created.taskId);
  } catch (err) {
    console.warn("[captcha] capsolver error:", err);
    return null;
  }
}

export async function solveHcaptcha({ sitekey, url }: { sitekey: string; url: string }): Promise<string | null> {
  const p = provider();
  if (p === "twocaptcha") return twocaptcha("hcaptcha", sitekey, url);
  if (p === "capsolver") return capsolver("hcaptcha", sitekey, url, false);
  return null;
}

export async function solveRecaptcha({ sitekey, url, enterprise }: { sitekey: string; url: string; enterprise: boolean }): Promise<string | null> {
  const p = provider();
  if (p === "twocaptcha") return twocaptcha("recaptcha", sitekey, url);
  if (p === "capsolver") return capsolver("recaptcha", sitekey, url, enterprise);
  return null;
}
