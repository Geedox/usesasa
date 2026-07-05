import type { Config } from "./config";

export type QueuedApp = {
  id: string;
  company: string;
  title: string;
  applyUrl: string;
  fields: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    linkedin: string;
    github: string;
    portfolio: string;
  };
  resumeUrl: string | null;
  coverLetter: string;
  answers: Record<string, string>;
};

export type SubmitResult = "submitted" | "needs_user" | "failed";

export type Stats = {
  userId?: string;
  balance: number;
  counts: { ready: number; submitted: number; needsYou: number; failed: number; skipped: number };
  recent: { company: string; title: string; state: string; at: string | null }[];
};

// Mark a job the user applied to in their own browser (quick fill / tailor + submit)
// as applied, so the dashboard reflects it. Charges 1 credit.
export async function markApplied(cfg: Config, payload: { title: string; company: string; url: string }): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${cfg.baseUrl}/api/extension/mark-applied`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error || `error ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, error: "network error" };
  }
}

export async function fetchStats(cfg: Config): Promise<Stats | null> {
  try {
    const res = await fetch(`${cfg.baseUrl}/api/extension/stats`, { headers: { Authorization: `Bearer ${cfg.token}` } });
    if (!res.ok) return null;
    return (await res.json()) as Stats;
  } catch {
    return null;
  }
}

export async function fetchQueue(cfg: Config): Promise<{ balance: number; applications: QueuedApp[] }> {
  const res = await fetch(`${cfg.baseUrl}/api/extension/queue`, {
    headers: { Authorization: `Bearer ${cfg.token}` },
  });
  if (!res.ok) throw new Error(`queue ${res.status}`);
  return res.json();
}

export type ProfileFields = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  portfolio: string;
};
export type ExtensionProfile = { fields: ProfileFields; resumeUrl: string | null; hasProfile: boolean };

// The user's base profile, used by the universal autofill widget to prefill any
// job form on the web (not tied to a queued application).
export async function fetchProfile(cfg: Config): Promise<ExtensionProfile | null> {
  try {
    const res = await fetch(`${cfg.baseUrl}/api/extension/profile`, { headers: { Authorization: `Bearer ${cfg.token}` } });
    if (!res.ok) return null;
    return (await res.json()) as ExtensionProfile;
  } catch {
    return null;
  }
}

export type TailoredFill = { fields: ProfileFields; coverLetter: string; answers: Record<string, string>; resumeBase64: string | null; resumeName: string };
export type TailorResult =
  | { ready: true; fields: ProfileFields; coverLetter: string; answers: Record<string, string>; resumeBase64: string | null; resumeName: string }
  | { ready: false; blocked?: boolean; message?: string };

// Queue tailoring for a scraped job. Returns the application id to poll.
export async function tailorAdhoc(
  cfg: Config,
  payload: { title: string; company: string; jd: string; url: string; embellish?: boolean },
): Promise<{ ok: true; applicationId: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${cfg.baseUrl}/api/extension/tailor-adhoc`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error || "Tailoring failed." };
    return { ok: true, applicationId: (data as { applicationId: string }).applicationId };
  } catch {
    return { ok: false, error: "Network error." };
  }
}

export type TailorLookup = { found: false } | { found: true; applicationId: string; ready: boolean; state: string };

// Have we already tailored this job page? Lets the widget show the existing
// result on revisit instead of re-charging. Matched by the page URL.
export async function tailorLookup(cfg: Config, url: string): Promise<TailorLookup> {
  try {
    const res = await fetch(`${cfg.baseUrl}/api/extension/tailor-lookup?url=${encodeURIComponent(url)}`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
    });
    if (!res.ok) return { found: false };
    return (await res.json()) as TailorLookup;
  } catch {
    return { found: false };
  }
}

// Poll for the tailored result (cover + resume) once the worker finishes.
export async function tailorResult(cfg: Config, id: string): Promise<TailorResult | null> {
  try {
    const res = await fetch(`${cfg.baseUrl}/api/extension/tailor-result?id=${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as TailorResult;
  } catch {
    return null;
  }
}

export type DraftedMessage = { to: string; kind: "email" | "dm"; subject: string; body: string };

// Draft an application email/DM for pages where you apply by email or DM.
export async function draftMessage(
  cfg: Config,
  payload: { title?: string; company?: string; jd?: string; contactKind: "email" | "dm"; contactValue: string },
): Promise<{ ok: true; data: DraftedMessage } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${cfg.baseUrl}/api/extension/draft-message`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error || "Could not draft." };
    return { ok: true, data: data as DraftedMessage };
  } catch {
    return { ok: false, error: "Network error." };
  }
}

export type MatchScore = { score: number; reason: string };

// Score the currently open job against the user's profile (0-100 + a reason).
export async function matchScore(
  cfg: Config,
  payload: { title?: string; company?: string; jd?: string; url?: string },
): Promise<{ ok: true; data: MatchScore } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${cfg.baseUrl}/api/extension/match-score`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error || "Could not score." };
    return { ok: true, data: data as MatchScore };
  } catch {
    return { ok: false, error: "Network error." };
  }
}

export type AnswerQuestion = { id: string; label: string; type: string; options?: string[] };

// Suggest answers to scanned questions for an arbitrary job page (no application).
// Returns the answers map, plus an error string when the server blocked the request
// (for example no credits) so the widget can tell the user.
export async function suggestAnswers(
  cfg: Config,
  payload: { questions: AnswerQuestion[]; title?: string; company?: string; jd?: string },
): Promise<{ answers: Record<string, string>; error?: string }> {
  try {
    const res = await fetch(`${cfg.baseUrl}/api/extension/suggest-answers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as { answers?: Record<string, string>; error?: string };
    if (!res.ok) return { answers: {}, error: data.error || "Could not suggest answers." };
    return { answers: data.answers ?? {} };
  } catch {
    return { answers: {}, error: "Network error." };
  }
}

// Ask the server to answer custom application questions (from the candidate's profile + the job).
export async function answerQuestions(
  cfg: Config,
  applicationId: string,
  questions: AnswerQuestion[],
): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${cfg.baseUrl}/api/extension/answer`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId, questions }),
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { answers?: Record<string, string> };
    return data.answers ?? {};
  } catch {
    return {};
  }
}

export async function report(cfg: Config, applicationId: string, result: SubmitResult, reason?: string): Promise<void> {
  await fetch(`${cfg.baseUrl}/api/extension/report`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ applicationId, result, reason }),
  });
}
