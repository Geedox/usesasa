"use client";

import { useEffect, useState, useRef } from "react";

const locations = [
  { city: "Greenhouse", region: "boards.greenhouse.io", latency: "watching" },
  { city: "Lever", region: "jobs.lever.co", latency: "watching" },
  { city: "Ashby", region: "jobs.ashbyhq.com", latency: "watching" },
  { city: "Wellfound", region: "startup roles", latency: "watching" },
  {
    city: "YC! Work at a Startup",
    region: "ycombinator.com",
    latency: "watching",
  },
  {
    city: "Remote OK · We Work Remotely",
    region: "remote-only",
    latency: "watching",
  },
];

export function InfrastructureSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeLocation, setActiveLocation] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 },
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveLocation((prev) => (prev + 1) % locations.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-24 lg:py-32 overflow-hidden"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left: Content */}
          <div
            className={`transition-all duration-700 ${
              isVisible
                ? "opacity-100 translate-x-0"
                : "opacity-0 -translate-x-8"
            }`}
          >
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
              <span className="w-8 h-px bg-foreground/30" />
              Discovery
            </span>
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-8">
              We watch, so
              <br />
              you're first.
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-12">
              Sasa polls company career pages directly: Greenhouse, Lever, Ashby
              and remote boards, every 15 minutes. A fitting role surfaces in
              your feed within 20 minutes of going live, while most applicants
              are still asleep.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8">
              <div>
                <div className="text-4xl lg:text-5xl font-display mb-2">
                  50k+
                </div>
                <div className="text-sm text-muted-foreground">
                  Pages watched
                </div>
              </div>
              <div>
                <div className="text-4xl lg:text-5xl font-display mb-2">
                  15 min
                </div>
                <div className="text-sm text-muted-foreground">
                  Poll interval
                </div>
              </div>
              <div>
                <div className="text-4xl lg:text-5xl font-display mb-2">
                  &lt;20m
                </div>
                <div className="text-sm text-muted-foreground">
                  Posting to feed
                </div>
              </div>
            </div>
          </div>

          {/* Right: Location list */}
          <div
            className={`transition-all duration-700 delay-200 ${
              isVisible
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-8"
            }`}
          >
            <div className="border border-foreground/10">
              {/* Header */}
              <div className="px-6 py-4 border-b border-foreground/10 flex items-center justify-between">
                <span className="text-sm font-mono text-muted-foreground">
                  Sources
                </span>
                <span className="flex items-center gap-2 text-xs font-mono text-green-600">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  All live
                </span>
              </div>

              {/* Locations */}
              <div>
                {locations.map((location, index) => (
                  <div
                    key={location.city}
                    className={`px-6 py-5 border-b border-foreground/5 last:border-b-0 flex items-center justify-between transition-all duration-300 ${
                      activeLocation === index ? "bg-foreground/[0.02]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                          activeLocation === index
                            ? "bg-foreground"
                            : "bg-foreground/20"
                        }`}
                      />
                      <div>
                        <div className="font-medium">{location.city}</div>
                        <div className="text-sm text-muted-foreground">
                          {location.region}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-sm text-muted-foreground">
                      {location.latency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
