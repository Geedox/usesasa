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

export function inferRemote(location: string, isRemote?: boolean): string | null {
  if (isRemote) return "remote";
  const l = (location || "").toLowerCase();
  if (l.includes("remote")) return "remote";
  if (l.includes("hybrid")) return "hybrid";
  return location ? "onsite" : null;
}
