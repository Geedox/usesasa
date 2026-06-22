// Detect how to apply when there's no form: an email address (mailto or near
// "apply/send your CV") or a DM handle ("DM @someone"). Used by the universal
// widget to draft an application email/DM for the user to copy.

export type Contact = { kind: "email" | "dm"; value: string };

const APPLY_CTX = /apply|application|send (your |us )?(cv|resume|résumé)|cv to|resume to|reach out|email us|hiring|recruit|careers?/i;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

export function scanContact(): Contact | null {
  // 1) An explicit mailto link is the strongest signal.
  const mailto = document.querySelector<HTMLAnchorElement>('a[href^="mailto:"]');
  if (mailto) {
    const addr = decodeURIComponent(mailto.getAttribute("href")!.slice(7).split("?")[0]).trim();
    if (EMAIL_RE.test(addr)) return { kind: "email", value: addr };
  }

  const text = (document.body.innerText || "").replace(/\s+/g, " ");

  // 2) An email that appears near apply/CV wording.
  EMAIL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EMAIL_RE.exec(text))) {
    const around = text.slice(Math.max(0, m.index - 90), m.index + 90);
    if (APPLY_CTX.test(around) && !/\.(png|jpg|jpeg|gif|webp)$/i.test(m[0])) {
      return { kind: "email", value: m[0] };
    }
  }

  // 3) A DM handle: "DM @handle" / "send a dm to @handle" / on x.com a tweet.
  const dm = text.match(/\b(?:dm|message|reach out to)\b[^@]{0,30}@([a-zA-Z0-9_]{2,20})/i);
  if (dm) return { kind: "dm", value: `@${dm[1]}` };
  if (/(^|\.)(x|twitter)\.com$/.test(location.hostname)) {
    const handle = location.pathname.split("/").filter(Boolean)[0];
    if (handle && /^[a-zA-Z0-9_]{2,20}$/.test(handle)) return { kind: "dm", value: `@${handle}` };
  }

  return null;
}
