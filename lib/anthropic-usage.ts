import type Anthropic from "@anthropic-ai/sdk";

// Log token usage for a single Anthropic call so spend is visible per feature in
// the worker/server logs. Tag it with the feature name, e.g. logUsage("tailor.generate", msg).
export function logUsage(tag: string, msg: Anthropic.Message): void {
  const u = msg.usage;
  const inTok = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
  console.log(`[anthropic] ${tag} model=${msg.model} in=${inTok} out=${u.output_tokens ?? 0}`);
}
