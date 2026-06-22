// Personio public jobs XML feed. No auth required.
// https://<account>.jobs.personio.com/xml -> <workzag-jobs><position>...</position>
import { type NormalizedJob, stripHtml, inferRemote } from "./util";

const tag = (block: string, name: string): string => {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1] : "";
};

export async function fetchPersonioJobs(slug: string): Promise<NormalizedJob[]> {
  const res = await fetch(`https://${encodeURIComponent(slug)}.jobs.personio.com/xml`, {
    headers: { Accept: "application/xml", "User-Agent": "Mozilla/5.0" },
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Personio ${slug}: HTTP ${res.status}`);

  const xml = await res.text();
  const blocks = xml.match(/<position>[\s\S]*?<\/position>/g) ?? [];
  return blocks
    .map((b) => {
      const id = stripHtml(tag(b, "id")).trim();
      const office = stripHtml(tag(b, "office")).trim();
      const created = stripHtml(tag(b, "createdAt")).trim();
      // jobDescriptions holds nested <value> HTML blocks — concat them for the JD.
      const jd = stripHtml(tag(b, "jobDescriptions")).slice(0, 8000);
      return {
        externalId: id,
        title: stripHtml(tag(b, "name")).trim(),
        location: office,
        remotePolicy: inferRemote(office),
        postedAt: created ? new Date(created) : null,
        rawJd: jd,
        url: `https://${slug}.jobs.personio.com/job/${id}`,
      };
    })
    .filter((j) => j.externalId && j.title);
}
