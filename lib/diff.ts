export type DiffToken = { value: string; type: "same" | "added" | "removed" };

// Word-level diff (LCS). Tokens keep their trailing whitespace so reassembly is exact.
export function diffWords(oldStr: string, newStr: string): DiffToken[] {
  const tok = (s: string) => (s.match(/\S+\s*/g) ?? []) as string[];
  const a = tok(oldStr);
  const b = tok(newStr);
  const n = a.length;
  const m = b.length;

  // LCS length table.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i].trim() === b[j].trim() ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i].trim() === b[j].trim()) {
      out.push({ value: b[j], type: "same" });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ value: a[i], type: "removed" });
      i++;
    } else {
      out.push({ value: b[j], type: "added" });
      j++;
    }
  }
  while (i < n) out.push({ value: a[i++], type: "removed" });
  while (j < m) out.push({ value: b[j++], type: "added" });
  return out;
}
