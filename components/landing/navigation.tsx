"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import Link from "next/link";

const navLinks = [
  { name: "How it works", href: "#how-it-works" },
  { name: "Interview prep", href: "#interview-prep" },
  { name: "Channels", href: "#developers" },
  { name: "Pricing", href: "#pricing" },
  { name: "FAQ", href: "#faq" },
];

// The Sasa product walkthrough on YouTube.
const YT_ID = "qd5kcNAfHj0";

function YouTubeGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 28 20" width={size} height={(size * 20) / 28} aria-hidden="true" className="shrink-0">
      <path d="M27.4 3.12a3.5 3.5 0 0 0-2.46-2.48C22.7.02 14 .02 14 .02S5.3.02 3.06.64A3.5 3.5 0 0 0 .6 3.12 36.6 36.6 0 0 0 0 10a36.6 36.6 0 0 0 .6 6.88 3.5 3.5 0 0 0 2.46 2.48C5.3 20 14 20 14 20s8.7 0 10.94-.64a3.5 3.5 0 0 0 2.46-2.48A36.6 36.6 0 0 0 28 10a36.6 36.6 0 0 0-.6-6.88Z" fill="#FF0000" />
      <path d="M11.2 14.29 18.4 10l-7.2-4.29v8.58Z" fill="#fff" />
    </svg>
  );
}

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed z-50 transition-all duration-500 ${
        isScrolled 
          ? "top-4 left-4 right-4" 
          : "top-0 left-0 right-0"
      }`}
    >
      <nav
        className={`relative z-50 mx-auto transition-all duration-500 ${
          isScrolled || isMobileMenuOpen
            ? "bg-background/80 backdrop-blur-xl border border-foreground/10 rounded-2xl shadow-lg max-w-[1200px]"
            : "bg-transparent max-w-[1400px]"
        }`}
      >
        <div 
          className={`flex items-center justify-between transition-all duration-500 px-6 lg:px-8 ${
            isScrolled ? "h-14" : "h-20"
          }`}
        >
          {/* Logo */}
          <a href="#" className="flex items-center gap-2 group">
            <span className={`font-display tracking-tight transition-all duration-500 ${isScrolled ? "text-xl" : "text-2xl"}`}>Sasa</span>
            <span className={`text-muted-foreground font-mono transition-all duration-500 ${isScrolled ? "text-[10px] mt-0.5" : "text-xs mt-1"}`}>beta</span>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-12">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-sm text-foreground/70 hover:text-foreground transition-colors duration-300 relative group"
              >
                {link.name}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-foreground transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <button
              type="button"
              onClick={() => setVideoOpen(true)}
              className="inline-flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
            >
              <YouTubeGlyph size={22} />
              Watch demo
            </button>
            {/* <a href="#" className={`text-foreground/70 hover:text-foreground transition-all duration-500 ${isScrolled ? "text-xs" : "text-sm"}`}>
              Log in
            </a> */}
            <Button
              size="sm"
              asChild
              className={`bg-foreground hover:bg-foreground/90 text-background rounded-full transition-all duration-500 cursor-pointer ${isScrolled ? "px-4 h-8 text-xs" : "px-6"}`}
            >
              <Link href="/login">Get started</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

      </nav>
      
      {/* Mobile Menu - Full Screen Overlay */}
      <div
        className={`md:hidden fixed inset-0 bg-background z-40 transition-all duration-500 ${
          isMobileMenuOpen 
            ? "opacity-100 pointer-events-auto" 
            : "opacity-0 pointer-events-none"
        }`}
        style={{ top: 0 }}
      >
        <div className="flex flex-col h-full px-8 pt-28 pb-8">
          {/* Navigation Links */}
          <div className="flex-1 flex flex-col justify-center gap-8">
            {navLinks.map((link, i) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-5xl font-display text-foreground hover:text-muted-foreground transition-all duration-500 ${
                  isMobileMenuOpen 
                    ? "opacity-100 translate-y-0" 
                    : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: isMobileMenuOpen ? `${i * 75}ms` : "0ms" }}
              >
                {link.name}
              </a>
            ))}
          </div>
          
          {/* Bottom CTAs */}
          <div className={`flex gap-4 pt-8 border-t border-foreground/10 transition-all duration-500 ${
            isMobileMenuOpen 
              ? "opacity-100 translate-y-0" 
              : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: isMobileMenuOpen ? "300ms" : "0ms" }}
          >
            <Button
              variant="outline"
              className="flex-1 rounded-full h-14 text-base cursor-pointer inline-flex items-center gap-2"
              onClick={() => { setIsMobileMenuOpen(false); setVideoOpen(true); }}
            >
              <YouTubeGlyph size={22} />
              Watch demo
            </Button>
            <Button
              asChild
              className="flex-1 bg-foreground text-background rounded-full h-14 text-base cursor-pointer"
            >
              <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                Get started
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Embedded walkthrough modal */}
      {videoOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setVideoOpen(false)}
        >
          <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setVideoOpen(false)}
              aria-label="Close video"
              className="absolute -top-11 right-0 inline-flex items-center gap-1.5 text-white/80 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" /> Close
            </button>
            <div className="relative w-full overflow-hidden rounded-xl bg-black shadow-2xl" style={{ aspectRatio: "16 / 9" }}>
              <iframe
                src={`https://www.youtube.com/embed/${YT_ID}?autoplay=1&rel=0`}
                title="Sasa product walkthrough"
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
