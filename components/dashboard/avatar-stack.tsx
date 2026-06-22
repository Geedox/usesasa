// Overlapping circular avatars (mentor faces) with a "+N" overflow bubble. Server
// component — used to show the mentor roster at a glance ("Access N mentors").
const COLORS = [
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-orange-100 text-orange-700",
];

function initials(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function AvatarStack({
  people,
  total,
  size = 40,
  max = 6,
}: {
  people: { name: string; photoUrl: string | null }[];
  total: number;
  size?: number;
  max?: number;
}) {
  const shown = people.slice(0, max);
  const overflow = total - shown.length;

  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span
          key={i}
          className={`shrink-0 rounded-full overflow-hidden ring-2 ring-background flex items-center justify-center font-semibold ${p.photoUrl ? "bg-white" : colorFor(p.name)}`}
          style={{ width: size, height: size, marginLeft: i === 0 ? 0 : -size * 0.3, fontSize: Math.round(size * 0.36), zIndex: shown.length - i }}
          title={p.name}
        >
          {p.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            initials(p.name)
          )}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="shrink-0 rounded-full ring-2 ring-background bg-foreground text-background flex items-center justify-center font-semibold"
          style={{ width: size, height: size, marginLeft: -size * 0.3, fontSize: Math.round(size * 0.32) }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
