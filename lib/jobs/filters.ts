import { eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { jobs } from "@/lib/db/schema";

// Seniority buckets, matched against the job title with Postgres case-insensitive
// regex (~*) and word boundaries (\y) so "sr" doesn't match "disregard". "mid" is
// defined as a title with NO seniority marker at all.
export const SENIORITY = [
  { key: "internship", label: "Internship", rx: "(intern|internship|trainee|co-?op|industrial training|nysc)" },
  { key: "entry", label: "Entry / Junior", rx: "(junior|jr|entry|entry-level|graduate|associate|early career)" },
  { key: "mid", label: "Mid", rx: null },
  { key: "senior", label: "Senior", rx: "(senior|sr|staff|principal)" },
  { key: "manager", label: "Lead / Manager", rx: "(lead|manager|head|director|principal|vp|chief|president)" },
] as const;

export type SeniorityKey = (typeof SENIORITY)[number]["key"];

const ANY_SENIORITY = "(intern|trainee|junior|jr|entry|graduate|associate|senior|sr|staff|principal|lead|manager|head|director|vp|chief|president)";

export function seniorityCondition(lvl?: string): SQL | undefined {
  const s = SENIORITY.find((x) => x.key === lvl);
  if (!s) return undefined;
  if (s.key === "mid") return sql`${jobs.title} !~* ${`\\y${ANY_SENIORITY}\\y`}`;
  return sql`${jobs.title} ~* ${`\\y${s.rx}\\y`}`;
}

// Location/country filter. "remote" matches the remote policy or a remote
// location; otherwise we match the country/place name anywhere in the location.
export function locationCondition(loc?: string): SQL | undefined {
  const v = (loc ?? "").trim();
  if (!v) return undefined;
  if (v.toLowerCase() === "remote") return or(eq(jobs.remotePolicy, "remote"), ilike(jobs.location, "%remote%"));
  return ilike(jobs.location, `%${v}%`);
}

// Workplace type, from the job's remote policy (remote / hybrid / onsite).
export const WORKPLACE = [
  { key: "remote", label: "Remote" },
  { key: "hybrid", label: "Hybrid" },
  { key: "onsite", label: "Onsite" },
] as const;

export type WorkplaceKey = (typeof WORKPLACE)[number]["key"];

export function workplaceCondition(work?: string): SQL | undefined {
  if (!work || !WORKPLACE.some((w) => w.key === work)) return undefined;
  return eq(jobs.remotePolicy, work);
}

// Visa-sponsorship signal: jobs whose description mentions sponsorship. Company-
// level sponsorship data is mostly unknown, so the JD text is the practical signal.
const SPONSOR_RX = "\\y(visa sponsor|sponsorship|will sponsor|sponsor your|h-?1b|tier 2|skilled worker visa)\\y";

export function sponsorCondition(on?: boolean): SQL | undefined {
  return on ? sql`${jobs.rawJd} ~* ${SPONSOR_RX}` : undefined;
}
