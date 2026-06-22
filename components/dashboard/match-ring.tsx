// Circular match-score ring (shared by the dashboard + browse grid cards).
export function MatchRing({ value }: { value: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(Math.max(value, 0), 100) / 100) * c;
  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg viewBox="0 0 48 48" className="w-12 h-12 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="3" stroke="currentColor" className="text-foreground/10" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          stroke="currentColor"
          className="text-foreground"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-medium leading-none">{value}%</span>
        <span className="font-mono text-[7px] tracking-widest text-muted-foreground uppercase mt-0.5">match</span>
      </div>
    </div>
  );
}
