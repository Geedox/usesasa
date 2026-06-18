import type { Ats } from "@/lib/db/schema";

export type ParsedJobUrl = { ats: Ats; slug: string };

// Recognize a job/board URL and extract its ATS + company slug.
// Greenhouse: boards.greenhouse.io/<slug>/... | job-boards.greenhouse.io/<slug>/... | <slug>.greenhouse.io
// Lever:      jobs.lever.co/<slug>/...
// Ashby:      jobs.ashbyhq.com/<slug>/...
export function parseJobUrl(input: string): ParsedJobUrl | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const segs = url.pathname.split("/").filter(Boolean);

  if (host.endsWith("greenhouse.io")) {
    // <slug>.greenhouse.io
    const sub = host.replace(".greenhouse.io", "");
    if (sub && !["boards", "job-boards", "boards-api", "www", "app"].includes(sub)) {
      return { ats: "greenhouse", slug: sub };
    }
    // boards.greenhouse.io/<slug>/...
    if (segs[0] === "embed") {
      const forParam = url.searchParams.get("for");
      if (forParam) return { ats: "greenhouse", slug: forParam };
    }
    if (segs[0]) return { ats: "greenhouse", slug: segs[0] };
  }

  if (host.endsWith("lever.co") && segs[0]) {
    return { ats: "lever", slug: segs[0] };
  }

  if (host.endsWith("ashbyhq.com") && segs[0]) {
    return { ats: "ashby", slug: segs[0] };
  }

  return null;
}
