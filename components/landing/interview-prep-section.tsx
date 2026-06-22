"use client";

import { useEffect, useRef, useState } from "react";

const points = [
  {
    title: "Real mentors",
    body: "Senior engineers, product managers and operators who have sat on the other side of the table.",
  },
  {
    title: "An honest score",
    body: "Every session ends with a clear score out of 100 and the reasons behind it, shared with you.",
  },
  {
    title: "Notes you can act on",
    body: "Specific feedback on what to sharpen before the real call, not vague encouragement.",
  },
];

function ScoreVisual({ active }: { active: boolean }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const pct = 92;
  const offset = active ? c * (1 - pct / 100) : c;
  const mentors = ["A", "O", "K", "T", "N"];

  return (
    <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-8 lg:p-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-sm font-mono text-muted-foreground">Mock interview</div>
          <div className="font-display text-lg">Senior Backend Engineer</div>
        </div>
        <span className="text-xs font-mono text-muted-foreground rounded-full border border-foreground/15 px-3 py-1">
          scored
        </span>
      </div>

      <div className="flex flex-col items-center">
        <div className="relative w-44 h-44">
          <svg viewBox="0 0 180 180" className="w-44 h-44 -rotate-90">
            <circle cx="90" cy="90" r={r} fill="none" strokeWidth="10" stroke="currentColor" className="text-foreground/10" />
            <circle
              cx="90"
              cy="90"
              r={r}
              fill="none"
              strokeWidth="10"
              stroke="currentColor"
              strokeLinecap="round"
              className="text-foreground"
              strokeDasharray={c}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 1.4s ease-out" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-5xl leading-none">{pct}</span>
            <span className="text-sm font-mono text-muted-foreground mt-1">out of 100</span>
          </div>
        </div>

        <p className="mt-6 text-center text-muted-foreground leading-relaxed max-w-sm">
          &ldquo;Strong system design and clear communication. Tighten your STAR answers on conflict and you are interview ready.&rdquo;
        </p>
      </div>

      <div className="mt-8 pt-6 border-t border-foreground/10 flex items-center gap-3">
        <div className="flex -space-x-2">
          {mentors.map((m, i) => (
            <span
              key={i}
              className="w-8 h-8 rounded-full border border-background bg-foreground/10 grid place-items-center text-xs font-medium"
            >
              {m}
            </span>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">Senior mentors across engineering, product and design.</span>
      </div>
    </div>
  );
}

export function InterviewPrepSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.15 },
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="interview-prep" ref={sectionRef} className="relative py-24 lg:py-32">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Copy */}
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
              <span className="w-8 h-px bg-foreground/30" />
              Interview prep
            </span>
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-6">
              You got the interview.
              <br />
              <span className="text-muted-foreground">Now walk in ready.</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-10 max-w-xl">
              Book a mock interview with a senior professional in your field. They run you through the real
              questions, then hand you an honest score out of 100 and exactly what to fix before the call that counts.
            </p>

            <div className="space-y-6">
              {points.map((p) => (
                <div key={p.title} className="flex gap-4">
                  <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />
                  <div>
                    <h3 className="font-display text-xl mb-1">{p.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{p.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visual */}
          <div
            className={`transition-all duration-700 delay-150 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <ScoreVisual active={isVisible} />
          </div>
        </div>
      </div>
    </section>
  );
}
