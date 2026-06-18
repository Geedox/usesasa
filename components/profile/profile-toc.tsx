"use client";

import { useEffect, useState } from "react";

const TOC = [
  { id: "profile", label: "Profile" },
  { id: "documents", label: "Documents" },
  { id: "experience", label: "Experience" },
  { id: "education", label: "Education" },
  { id: "skills", label: "Skills" },
  { id: "certifications", label: "Certifications" },
  { id: "languages", label: "Languages" },
  { id: "application-defaults", label: "Application defaults" },
  { id: "custom", label: "Add section" },
];

export function ProfileToc() {
  const [active, setActive] = useState(TOC[0].id);

  useEffect(() => {
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting);
        // The topmost section (in document order) currently in the activation band wins.
        const current = TOC.find((t) => visible.get(t.id));
        if (current) setActive(current.id);
      },
      // Activation band: a section is "active" once its top reaches the upper ~40% of the viewport.
      { rootMargin: "0px 0px -60% 0px", threshold: 0 },
    );

    const els = TOC.map((t) => document.getElementById(t.id)).filter(Boolean) as Element[];
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="hidden lg:block">
      <ul className="sticky top-6 space-y-1.5 text-sm">
        {TOC.map((t) => (
          <li key={t.id}>
            <a
              href={`#${t.id}`}
              onClick={() => setActive(t.id)}
              className={`flex items-center gap-2 transition-colors ${
                active === t.id ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  active === t.id ? "bg-foreground" : "bg-transparent"
                }`}
              />
              {t.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
