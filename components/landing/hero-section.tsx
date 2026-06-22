"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { AnimatedSphere } from "./animated-sphere";
import Link from "next/link";

const words = ["fits you", "pays more", "sponsors", "ships fast"];
// Reserve space for the widest word so swapping words never reflows the headline.
const longestWord = words.reduce((a, b) => (b.length > a.length ? b : a), "");

const roleTypes = ["Remote", "Onsite", "Hybrid", "Local", "International"];

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % words.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
      {/* Animated sphere background */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] h-[600px] lg:w-[800px] lg:h-[800px] opacity-40 pointer-events-none">
        <AnimatedSphere />
      </div>

      {/* Subtle grid lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        {[...Array(8)].map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute h-px bg-foreground/10"
            style={{
              top: `${12.5 * (i + 1)}%`,
              left: 0,
              right: 0,
            }}
          />
        ))}
        {[...Array(12)].map((_, i) => (
          <div
            key={`v-${i}`}
            className="absolute w-px bg-foreground/10"
            style={{
              left: `${8.33 * (i + 1)}%`,
              top: 0,
              bottom: 0,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 py-32 lg:py-40">
        {/* Eyebrow */}
        <div
          className={`mb-8 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground">
            <span className="w-8 h-px bg-foreground/30" />
            For professionals chasing the next move
          </span>
        </div>

        {/* Main headline */}
        <div className="mb-12">
          <h1
            className={`text-[clamp(3rem,12vw,10rem)] font-display leading-[0.9] tracking-tight transition-all duration-1000 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
          >
            <span className="block">Apply to every</span>
            <span className="block">
              job that{" "}
              <span className="relative inline-block align-top">
                {/* Invisible sizer holds the width of the longest word, so the
                    rotating word below cannot shift the layout. */}
                <span className="invisible" aria-hidden>
                  {longestWord}
                </span>
                <span key={wordIndex} className="absolute left-0 top-0 inline-flex">
                  {words[wordIndex].split("").map((char, i) => (
                    <span
                      key={`${wordIndex}-${i}`}
                      className="inline-block animate-char-in"
                      style={{
                        animationDelay: `${i * 50}ms`,
                      }}
                    >
                      {char === " " ? " " : char}
                    </span>
                  ))}
                </span>
                <span className="absolute -bottom-2 left-0 right-0 h-3 bg-foreground/10" />
              </span>
            </span>
          </h1>
        </div>

        {/* Role types */}
        <div
          className={`flex flex-wrap gap-2 mb-10 transition-all duration-700 delay-150 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          {roleTypes.map((t) => (
            <span
              key={t}
              className="rounded-full border border-foreground/15 bg-foreground/[0.02] px-3.5 py-1.5 text-sm text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>

        {/* Description */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-end">
          <p
            className={`text-xl lg:text-2xl text-muted-foreground leading-relaxed max-w-xl transition-all duration-700 delay-200 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            Sasa finds roles that fit you across Greenhouse, Lever, Ashby and
            more, tailors your CV per role, and applies from your own browser.
            Keep your day job. We will do the applying.
          </p>

          {/* CTAs */}
          <div
            className={`flex flex-row items-center gap-3 transition-all duration-700 delay-300 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            <Button
              size="lg"
              asChild
              className="bg-foreground hover:bg-foreground/90 text-background px-5 sm:px-8 h-12 sm:h-14 text-sm sm:text-base rounded-full group cursor-pointer whitespace-nowrap shrink-0"
            >
              <Link href="/login">
                Get started
                <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="h-12 sm:h-14 px-5 sm:px-8 text-sm sm:text-base rounded-full border-foreground/20 hover:bg-foreground/5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats marquee - full width outside container */}
      <div
        className={`absolute bottom-24 left-0 right-0 transition-all duration-700 delay-500 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex gap-16 marquee whitespace-nowrap">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex gap-16">
              {[
                {
                  value: "50,000+",
                  label: "career pages watched",
                  company: "DISCOVERY",
                },
                {
                  value: "<20 min",
                  label: "posting to your feed",
                  company: "SPEED",
                },
                { value: "₦333", label: "per application", company: "PRICING" },
                {
                  value: "1 reply",
                  label: "to apply on WhatsApp",
                  company: "HANDS OFF",
                },
              ].map((stat) => (
                <div
                  key={`${stat.company}-${i}`}
                  className="flex items-baseline gap-4"
                >
                  <span className="text-4xl lg:text-5xl font-display">
                    {stat.value}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {stat.label}
                    <span className="block font-mono text-xs mt-1">
                      {stat.company}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
    </section>
  );
}
