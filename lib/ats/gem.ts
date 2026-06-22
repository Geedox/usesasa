// Gem public job-board GraphQL API. No auth required.
// POST https://jobs.gem.com/api/public/graphql/batch  (operation JobBoardList)
import { type NormalizedJob, inferRemote } from "./util";

const QUERY =
  "query JobBoardList($boardId: String!) { oatsExternalJobPostings(boardId: $boardId) { jobPostings { id extId title locations { name city isoCountry isRemote } job { department { name } locationType employmentType } } } }";

type GemPosting = {
  id?: string;
  extId?: string;
  title?: string;
  locations?: { name?: string; city?: string; isoCountry?: string; isRemote?: boolean }[];
  job?: { locationType?: string };
};

export async function fetchGemJobs(slug: string): Promise<NormalizedJob[]> {
  const res = await fetch("https://jobs.gem.com/api/public/graphql/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    body: JSON.stringify([{ operationName: "JobBoardList", variables: { boardId: slug }, query: QUERY }]),
  });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => [])) as { data?: { oatsExternalJobPostings?: { jobPostings?: GemPosting[] } } }[];
  const postings = data?.[0]?.data?.oatsExternalJobPostings?.jobPostings ?? [];

  return postings
    .filter((p) => p.id && p.title)
    .map((p) => {
      const loc = p.locations?.[0];
      const location = loc?.name || [loc?.city, loc?.isoCountry].filter(Boolean).join(", ");
      const remote = p.job?.locationType === "REMOTE" || !!loc?.isRemote;
      return {
        externalId: p.extId || p.id!,
        title: p.title ?? "",
        location,
        remotePolicy: inferRemote(location, remote),
        postedAt: null,
        rawJd: "",
        url: `https://jobs.gem.com/${slug}/${p.id}`,
      };
    });
}
