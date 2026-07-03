import type Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { anthropicUsage } from "@/lib/db/schema";

// USD per 1M tokens, [input, output]. Estimates for the admin dashboard; update if
// Anthropic pricing changes. Unknown models fall back to Haiku pricing.
export const MODEL_PRICING: Record<string, [number, number]> = {
  "claude-haiku-4-5-20251001": [1, 5],
  "claude-sonnet-4-6": [3, 15],
  "claude-opus-4-8": [15, 75],
};
const FALLBACK: [number, number] = [1, 5];

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const [pin, pout] = MODEL_PRICING[model] ?? FALLBACK;
  return (inputTokens / 1_000_000) * pin + (outputTokens / 1_000_000) * pout;
}

// Log token usage for a single Anthropic call so spend is visible per feature, and
// persist it (best effort) for the admin usage dashboard. Tag with the feature name,
// e.g. logUsage("tailor.generate", msg).
export function logUsage(tag: string, msg: Anthropic.Message): void {
  const u = msg.usage;
  const inTok = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
  const outTok = u.output_tokens ?? 0;
  console.log(`[anthropic] ${tag} model=${msg.model} in=${inTok} out=${outTok}`);

  // Fire-and-forget: recording usage must never block or break the actual call.
  void (async () => {
    try {
      await db.insert(anthropicUsage).values({ tag, model: msg.model, inputTokens: inTok, outputTokens: outTok });
    } catch (e) {
      console.error("[anthropic-usage] persist failed:", e);
    }
  })();
}
