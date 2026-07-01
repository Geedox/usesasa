export type NormalizedJob = {
  externalId: string;
  title: string;
  location: string;
  remotePolicy: string | null;
  postedAt: Date | null;
  rawJd: string;
  url: string;
};

export function stripHtml(html: string): string {
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// A normalized "company|title" key so the same role from different sources collapses
// to one. Strips punctuation, common seniority/remote noise, and collapses whitespace.
export function makeDedupeKey(company: string, title: string): string {
  const norm = (s: string) =>
    (s || "")
      .toLowerCase()
      .replace(/\(.*?\)/g, " ") // drop parenthetical notes like "(remote)"
      .replace(/\b(remote|hybrid|onsite|on site|contract|full time|part time|intern(ship)?)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  const c = norm(company);
  const t = norm(title);
  return c && t ? `${c}|${t}` : "";
}

export function inferRemote(location: string, isRemote?: boolean): string | null {
  if (isRemote) return "remote";
  const l = (location || "").toLowerCase();
  if (l.includes("remote")) return "remote";
  if (l.includes("hybrid")) return "hybrid";
  return location ? "onsite" : null;
}
