import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, jobs } from "@/lib/db/schema";
import type { Ats } from "@/lib/db/schema";
import type { NormalizedJob } from "@/lib/ats/util";
import { fetchGreenhouseJobs } from "@/lib/ats/greenhouse";
import { fetchLeverJobs } from "@/lib/ats/lever";
import { fetchAshbyJobs } from "@/lib/ats/ashby";
import { fetchSmartRecruitersJobs } from "@/lib/ats/smartrecruiters";
import { fetchWorkdayJobs } from "@/lib/ats/workday";
import { fetchWorkableJobs } from "@/lib/ats/workable";
import { fetchTeamtailorJobs } from "@/lib/ats/teamtailor";
import { fetchRecruiteeJobs } from "@/lib/ats/recruitee";
import { fetchBambooHrJobs } from "@/lib/ats/bamboohr";
import { fetchBreezyJobs } from "@/lib/ats/breezy";
import { fetchPersonioJobs } from "@/lib/ats/personio";
import { fetchGemJobs } from "@/lib/ats/gem";
import { fetchZohoJobs } from "@/lib/ats/zoho";
import { fetchCustomJobs } from "@/lib/ats/custom";

const FETCHERS: Partial<Record<Ats, (slug: string) => Promise<NormalizedJob[]>>> = {
  greenhouse: fetchGreenhouseJobs,
  lever: fetchLeverJobs,
  ashby: fetchAshbyJobs,
  smartrecruiters: fetchSmartRecruitersJobs,
  workday: fetchWorkdayJobs,
  workable: fetchWorkableJobs,
  teamtailor: fetchTeamtailorJobs,
  recruitee: fetchRecruiteeJobs,
  bamboohr: fetchBambooHrJobs,
  breezy: fetchBreezyJobs,
  personio: fetchPersonioJobs,
  gem: fetchGemJobs,
  zoho: fetchZohoJobs, // slug = career-site host; reads jobs embedded in the page HTML
  custom: fetchCustomJobs, // slug = the careers-page URL
};

// Fetch a company's postings from its ATS and upsert into `jobs` (idempotent on
// source + external_id). Returns how many postings were found.
export async function crawlCompany(companyId: string, slug: string, ats: Ats): Promise<number> {
  const fetcher = FETCHERS[ats];
  if (!fetcher) return 0; // ats not supported yet

  const found = await fetcher(slug);

  if (found.length > 0) {
    await db
      .insert(jobs)
      .values(
        found.map((j) => ({
          companyId,
          source: ats,
          externalId: j.externalId,
          title: j.title,
          url: j.url,
          location: j.location,
          remotePolicy: j.remotePolicy,
          postedAt: j.postedAt,
          rawJd: j.rawJd,
          isActive: true,
        })),
      )
      .onConflictDoNothing({ target: [jobs.source, jobs.externalId] });
  }

  await db.update(companies).set({ lastCrawledAt: new Date() }).where(eq(companies.id, companyId));
  return found.length;
}
