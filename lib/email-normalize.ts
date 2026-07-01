// Email hygiene for anti-abuse: normalize aliases so the plus/dot trick can't mint
// infinite identities, and block known disposable/temp-mail domains at signup.

// Collapse an email to a canonical identity:
//  - lowercase, trim
//  - strip plus-addressing (you+anything -> you), which most providers support
//  - Gmail/Googlemail ignore dots and are the same inbox, so drop dots + unify domain
// e.g. "Y.O.U+jobs@googlemail.com" -> "you@gmail.com"
export function normalizeEmail(email: string): string {
  const e = (email || "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return e;
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  local = local.split("+")[0];
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

// A conservative list of common disposable / temp-mail domains. Extend with the
// DISPOSABLE_EMAIL_DOMAINS env var (comma separated) without a code change.
const DISPOSABLE = new Set<string>([
  "mailinator.com", "10minutemail.com", "10minutemail.net", "guerrillamail.com",
  "guerrillamail.info", "guerrillamail.biz", "guerrillamail.de", "guerrillamailblock.com",
  "sharklasers.com", "grr.la", "spam4.me", "temp-mail.org", "tempmail.com", "tempmailo.com",
  "tempr.email", "tempmail.net", "throwawaymail.com", "yopmail.com", "yopmail.net",
  "getnada.com", "nada.email", "trashmail.com", "trashmail.de", "dispostable.com",
  "maildrop.cc", "fakeinbox.com", "mailnesia.com", "mintemail.com", "mailcatch.com",
  "spamgourmet.com", "emailondeck.com", "moakt.com", "mohmal.com", "discard.email",
  "getairmail.com", "burnermail.io", "email-fake.com", "fakemail.net", "inboxbear.com",
  "1secmail.com", "1secmail.org", "1secmail.net", "harakirimail.com", "mailtemp.net",
  ...(process.env.DISPOSABLE_EMAIL_DOMAINS ?? "").split(",").map((d) => d.trim().toLowerCase()).filter(Boolean),
]);

export function isDisposableEmail(email: string): boolean {
  const at = (email || "").lastIndexOf("@");
  if (at < 0) return false;
  return DISPOSABLE.has(email.slice(at + 1).trim().toLowerCase());
}
