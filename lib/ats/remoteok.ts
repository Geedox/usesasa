// Remote OK public JSON feed (aggregator — many small/remote companies). No auth.
// https://remoteok.com/api  (first array element is metadata)
import { type NormalizedJob, stripHtml } from "./util";

// Aggregator jobs carry the employer name (they aren't tied to a watched company board).
export type AggregatorJob = NormalizedJob & { company: string };

type RemoteOkJob = {
  id?: string | number;
  company?: string;
  position?: string;
  location?: string;
  description?: string;
  url?: string;
  date?: string;
};

export async function fetchRemoteOkJobs(): Promise<AggregatorJob[]> {
  const res = await fetch("https://remoteok.com/api", {
    headers: { "User-Agent": "SasaBot/1.0 (+https://usesasa.xyz)", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`RemoteOK HTTP ${res.status}`);

  const data = (await res.json()) as RemoteOkJob[];
  return data
    .filter((j) => j.id && (j.position || j.company))
    .map((j) => ({
      company: j.company || "Unknown",
      externalId: String(j.id),
      title: j.position || "",
      location: j.location || "Remote",
      remotePolicy: "remote",
      postedAt: j.date ? new Date(j.date) : null,
      rawJd: j.description ? stripHtml(j.description).slice(0, 8000) : "",
      url: j.url || "",
    }));
}
