// International subscription plans (Nigeria uses prepaid credits instead — see
// lib/paystack.ts PACKS). Every tier is the full product; tiers differ only by the
// monthly application allowance, which resets each 30-day cycle.
//
// `paystackPlanCode` comes from your Paystack dashboard (create a Plan per tier in
// the currency below) and is read from env so you can set it without code changes.
export type Plan = {
  id: string;
  name: string;
  blurb: string;
  currency: "USD";
  amount: number; // cents
  applications: number; // per 30-day cycle
  popular?: boolean;
  paystackPlanCode: string;
};

export const FREE_ALLOWANCE = 20; // applications/cycle for users with no subscription (and not on credits)

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    blurb: "Enough for a real job search.",
    currency: "USD",
    amount: 1900,
    applications: 600,
    paystackPlanCode: process.env.PAYSTACK_PLAN_STARTER || "",
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "For the desperate, the laid off, the OPT clocked.",
    currency: "USD",
    amount: 3900,
    applications: 1500,
    popular: true,
    paystackPlanCode: process.env.PAYSTACK_PLAN_PRO || "",
  },
  {
    id: "power",
    name: "Power",
    blurb: "Hit every match before anyone else.",
    currency: "USD",
    amount: 9900,
    applications: 4500,
    paystackPlanCode: process.env.PAYSTACK_PLAN_POWER || "",
  },
];

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function allowanceFor(planId: string | null): number {
  if (!planId) return FREE_ALLOWANCE;
  return getPlan(planId)?.applications ?? FREE_ALLOWANCE;
}
