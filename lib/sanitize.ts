// Enforce the no-dash copy rule. The product never shows dash characters in
// user-facing copy, so we strip em (—), en (–), and hyphen (-) used as
// punctuation or inside compound words, and keep the text plain. This is a
// deterministic safety net on top of the generation prompt.
export function stripDashes(input: string): string {
  if (!input) return input;
  return input
    // em/en dash, with any surrounding spaces, becomes a comma
    .replace(/\s*[—–]\s*/g, ", ")
    // hyphen between word characters becomes a space (full-stack -> full stack)
    .replace(/([A-Za-z0-9])-([A-Za-z0-9])/g, "$1 $2")
    // a spaced hyphen used as a dash becomes a comma
    .replace(/\s+-\s+/g, ", ")
    // leading list hyphens at the start of a line
    .replace(/^[ \t]*-[ \t]+/gm, "")
    // any stray remaining hyphen characters
    .replace(/-/g, " ")
    // tidy doubled commas / spaces / leading punctuation
    .replace(/,\s*,/g, ",")
    .replace(/\s+,/g, ",")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[\s,]+/, "")
    .trim();
}
