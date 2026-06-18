"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowRight, Check, Loader2 } from "lucide-react";

type BetaModalContextValue = { open: () => void };

const BetaModalContext = createContext<BetaModalContextValue | null>(null);

export function useBetaModal() {
  const ctx = useContext(BetaModalContext);
  if (!ctx) throw new Error("useBetaModal must be used within <BetaModalProvider>");
  return ctx;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function BetaModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  // form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [okWithPricing, setOkWithPricing] = useState<"yes" | "no" | "">("");
  const [pricingFeedback, setPricingFeedback] = useState("");
  const [phone, setPhone] = useState("");
  const [onWhatsapp, setOnWhatsapp] = useState(false);
  const [onTelegram, setOnTelegram] = useState(false);

  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Geofence the pricing copy: Nigeria sees Naira, everyone else sees USD.
  const [isUSD, setIsUSD] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("https://ipwho.is/?fields=country_code");
        const data = (await res.json()) as { country_code?: string };
        if (alive && data?.country_code) setIsUSD(data.country_code !== "NG");
      } catch {
        /* keep the Naira default */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setOkWithPricing("");
    setPricingFeedback("");
    setPhone("");
    setOnWhatsapp(false);
    setOnTelegram(false);
    setStatus("idle");
    setErrorMsg("");
  };

  const open = () => {
    resetForm();
    setIsOpen(true);
  };

  const handleOpenChange = (next: boolean) => {
    setIsOpen(next);
    if (!next) resetForm();
  };

  const validate = (): string | null => {
    if (!fullName.trim()) return "Please enter your full name.";
    if (!EMAIL_RE.test(email.trim())) return "Please enter a valid email address.";
    if (!okWithPricing) return "Please let us know if the pricing works for you.";
    if (okWithPricing === "no" && !pricingFeedback.trim())
      return "Please tell us what doesn't work about the pricing.";
    if (!phone.trim()) return "Please enter your phone number.";
    if (!onWhatsapp && !onTelegram) return "Please pick WhatsApp, Telegram, or both.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setStatus("error");
      setErrorMsg(validationError);
      return;
    }

    setStatus("submitting");
    setErrorMsg("");

    const platforms = [
      onWhatsapp ? "WhatsApp" : null,
      onTelegram ? "Telegram" : null,
    ].filter(Boolean) as string[];

    try {
      const res = await fetch("/api/beta-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          okWithPricing,
          pricingFeedback: okWithPricing === "no" ? pricingFeedback.trim() : "",
          phone: phone.trim(),
          platforms,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Something went wrong. Please try again.");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <BetaModalContext.Provider value={{ open }}>
      {children}

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          {status === "success" ? (
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-14 h-14 rounded-full bg-foreground text-background flex items-center justify-center mb-6">
                <Check className="w-7 h-7" />
              </div>
              <DialogTitle className="font-display text-2xl mb-3">You're on the list.</DialogTitle>
              <DialogDescription className="text-base">
                Thanks, {fullName.split(" ")[0] || "there"}. If you're among the first 100, your
                50 free credits are reserved. We'll reach out on your phone number to add you to
                the community.
              </DialogDescription>
              <Button
                className="mt-8 rounded-full cursor-pointer"
                onClick={() => handleOpenChange(false)}
              >
                Done
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <div className="inline-flex items-center gap-2 self-start rounded-full border border-foreground/15 bg-foreground/[0.03] px-3 py-1 text-xs font-mono text-foreground mb-2">
                  🎉 First 100 beta users get 50 free credits
                </div>
                <DialogTitle className="font-display text-2xl">Join the beta</DialogTitle>
                <DialogDescription>
                  A few details and you're in. We'll ping you on WhatsApp or Telegram to get you set
                  up and into the community.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-2">
                {/* Full name */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="beta-name">Full name</Label>
                  <Input
                    id="beta-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Tunde Adeyemi"
                    autoComplete="name"
                  />
                </div>

                {/* Email */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="beta-email">Email</Label>
                  <Input
                    id="beta-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>

                {/* Pricing */}
                <div className="flex flex-col gap-2">
                  <Label>
                    Are you okay with the pricing?{" "}
                    <span className="text-muted-foreground font-normal">
                      (packs from {isUSD ? "$3.50, about $0.23" : "₦5,000, about ₦333"} per application, after your free credits)
                    </span>
                  </Label>
                  <div className="flex gap-3">
                    {(["yes", "no"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setOkWithPricing(value)}
                        className={`flex-1 rounded-lg border px-4 py-2.5 text-sm capitalize transition-colors cursor-pointer ${
                          okWithPricing === value
                            ? "border-foreground bg-foreground text-background"
                            : "border-foreground/15 hover:border-foreground/40"
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pricing feedback (only when "no") */}
                {okWithPricing === "no" && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="beta-feedback">What doesn't work about the pricing?</Label>
                    <Textarea
                      id="beta-feedback"
                      value={pricingFeedback}
                      onChange={(e) => setPricingFeedback(e.target.value)}
                      placeholder="Tell us what you'd expect to pay, or what's holding you back…"
                      rows={3}
                    />
                  </div>
                )}

                {/* Phone + platforms */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="beta-phone">Phone number</Label>
                  <Input
                    id="beta-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+234 801 234 5678"
                    autoComplete="tel"
                  />
                  <span className="text-xs text-muted-foreground">Reachable on (pick at least one):</span>
                  <div className="flex gap-3">
                    {[
                      { label: "WhatsApp", checked: onWhatsapp, toggle: () => setOnWhatsapp((v) => !v) },
                      { label: "Telegram", checked: onTelegram, toggle: () => setOnTelegram((v) => !v) },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={p.toggle}
                        className={`flex-1 rounded-lg border px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                          p.checked
                            ? "border-foreground bg-foreground text-background"
                            : "border-foreground/15 hover:border-foreground/40"
                        }`}
                      >
                        {p.checked ? "✓ " : ""}
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {status === "error" && (
                  <p className="text-sm text-red-600">{errorMsg}</p>
                )}

                <Button
                  type="submit"
                  disabled={status === "submitting"}
                  className="mt-1 h-12 rounded-full bg-foreground text-background hover:bg-foreground/90 cursor-pointer group"
                >
                  {status === "submitting" ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      Claim my spot
                      <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </BetaModalContext.Provider>
  );
}
