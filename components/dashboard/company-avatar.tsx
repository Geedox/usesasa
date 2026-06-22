"use client";

import { useState } from "react";

// Company avatar: shows the real logo when we have one, falling back to a
// deterministic colored-initials tile (so it is never broken/empty).
const COLORS = [
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-orange-100 text-orange-700",
  "bg-cyan-100 text-cyan-700",
  "bg-lime-100 text-lime-700",
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

export function CompanyAvatar({ name, logoUrl, size = 40 }: { name: string; logoUrl?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const showLogo = !!logoUrl && !failed;

  return (
    <span
      className={`shrink-0 rounded-lg overflow-hidden flex items-center justify-center font-semibold ${showLogo ? "bg-white" : colorFor(name)}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl!} alt="" className="w-full h-full object-contain" onError={() => setFailed(true)} loading="lazy" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
