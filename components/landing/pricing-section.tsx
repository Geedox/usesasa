"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    description: "Enough to test the waters",
    credits: 15,
    price: { ngn: "₦5,000", usd: "$3.50" },
    features: [
      "15 applications",
      "≈ ₦333 per application",
      "AI-tailored CV + cover letter per role",
      "WhatsApp match alerts",
      "Recruiter-reply tracking",
    ],
    cta: "Get Starter",
    popular: false,
  },
  {
    name: "Growth",
    description: "For a serious, steady search",
    credits: 50,
    price: { ngn: "₦15,000", usd: "$10" },
    features: [
      "50 applications",
      "≈ ₦300 per application",
      "Everything in Starter",
      "Sponsorship filtering (UK / CA / EU / AU)",
      "Daily digest + Kanban tracker",
    ],
    cta: "Get Growth",
    popular: true,
  },
  {
    name: "Hunter",
    description: "Go wide, hit every match",
    credits: 150,
    price: { ngn: "₦35,000", usd: "$23" },
    features: [
      "150 applications",
      "≈ ₦233 per application",
      "Everything in Growth",
      "Premium tailoring + follow-up emails",
      "Priority support",
    ],
    cta: "Get Hunter",
    popular: false,
  },
];

export function PricingSection() {
  const [isUSD, setIsUSD] = useState(false);

  return (
    <section
      id="pricing"
      className="relative py-32 lg:py-40 border-t border-foreground/10"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="max-w-3xl mb-20">
          <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase block mb-6">
            Pricing
          </span>
          <h2 className="font-display text-5xl md:text-6xl lg:text-7xl tracking-tight text-foreground mb-6">
            Pay for applications.
            <br />
            <span className="text-stroke">Not the tool.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl">
            Buy credits, not a subscription. 1 credit = 1 application submitted,
            and you're only charged when it actually goes out. Start with 5
            free.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center gap-4 mb-16">
          <span
            className={`text-sm transition-colors ${
              !isUSD ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Naira (₦)
          </span>
          <button
            onClick={() => setIsUSD(!isUSD)}
            className="relative w-14 h-7 bg-foreground/10 rounded-full p-1 transition-colors hover:bg-foreground/20"
          >
            <div
              className={`w-5 h-5 bg-foreground rounded-full transition-transform duration-300 ${
                isUSD ? "translate-x-7" : "translate-x-0"
              }`}
            />
          </button>
          <span
            className={`text-sm transition-colors ${
              isUSD ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            USD ($)
          </span>
          <span className="ml-2 px-2 py-1 bg-foreground text-primary-foreground text-xs font-mono">
            Paystack
          </span>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-px bg-foreground/10">
          {plans.map((plan, idx) => (
            <div
              key={plan.name}
              className={`relative p-8 lg:p-12 bg-background ${
                plan.popular
                  ? "md:-my-4 md:py-12 lg:py-16 border-2 border-foreground"
                  : ""
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-8 px-3 py-1 bg-foreground text-primary-foreground text-xs font-mono uppercase tracking-widest">
                  Most Popular
                </span>
              )}

              {/* Plan Header */}
              <div className="mb-8">
                <span className="font-mono text-xs text-muted-foreground">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-3xl text-foreground mt-2">
                  {plan.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {plan.description}
                </p>
              </div>

              {/* Price */}
              <div className="mb-8 pb-8 border-b border-foreground/10">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-5xl lg:text-6xl text-foreground">
                    {isUSD ? plan.price.usd : plan.price.ngn}
                  </span>
                  <span className="text-muted-foreground">
                    / {plan.credits} credits
                  </span>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-10">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-foreground mt-0.5 shrink-0" />
                    <span className="text-sm text-muted-foreground">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                className={`w-full py-4 flex items-center justify-center gap-2 text-sm font-medium transition-all group ${
                  plan.popular
                    ? "bg-foreground text-primary-foreground hover:bg-foreground/90"
                    : "border border-foreground/20 text-foreground hover:border-foreground hover:bg-foreground/5"
                }`}
              >
                {plan.cta}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          ))}
        </div>

        {/* Bottom Note */}
        <p className="mt-12 text-center text-sm text-muted-foreground">
          New here? Start with{" "}
          <span className="text-foreground">5 free applications</span> — no card
          required. Applying at scale? The{" "}
          <span className="text-foreground">Power</span> pack is ₦100,000 for
          500 credits (₦200 each).{" "}
          <a
            href="#"
            className="underline underline-offset-4 hover:text-foreground transition-colors"
          >
            See all packs
          </a>
        </p>
      </div>
    </section>
  );
}
