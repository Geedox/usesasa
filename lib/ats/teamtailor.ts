// Teamtailor public career feed (JSON Feed). No auth required.
// https://<account>.teamtailor.com/jobs.json -> { items: [{ id, title, url, content_html, date_published }] }
import { type NormalizedJob, stripHtml, inferRemote } from "./util";

type TTItem = { id?: string; title?: string; url?: string; content_html?: string; date_published?: string };

export async function fetchTeamtailorJobs(slug: string): Promise<NormalizedJob[]> {
  const res = await fetch(`https://${encodeURIComponent(slug)}.teamtailor.com/jobs.json`, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Teamtailor ${slug}: HTTP ${res.status}`);

  const data = (await res.json()) as { items?: TTItem[] };
  return (data.items ?? [])
    .filter((j) => j.id && j.url)
    .map((j) => {
      const jd = j.content_html ? stripHtml(j.content_html) : "";
      // The JSON Feed has no structured location; best-effort infer remote from the JD head.
      return {
        externalId: String(j.id),
        title: j.title ?? "",
        location: "",
        remotePolicy: inferRemote("", /\bremote\b/i.test(jd.slice(0, 500))),
        postedAt: j.date_published ? new Date(j.date_published) : null,
        rawJd: jd.slice(0, 8000),
        url: j.url ?? "",
      };
    });
}
