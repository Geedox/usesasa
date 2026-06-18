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

export async function fetchQueue(cfg: Config): Promise<{ balance: number; applications: QueuedApp[] }> {
  const res = await fetch(`${cfg.baseUrl}/api/extension/queue`, {
    headers: { Authorization: `Bearer ${cfg.token}` },
  });
  if (!res.ok) throw new Error(`queue ${res.status}`);
  return res.json();
}

export type AnswerQuestion = { id: string; label: string; type: string; options?: string[] };

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
