import { createHmac, timingSafeEqual } from "node:crypto";

// Prepaid credit packs. Credits are spent on the cash-cost actions only: a cloud
// browser submission (1 credit) and an interview prep booking (3 credits). The
// extension submission path and CV/cover tailoring are included (free).
//
// PRICING NOTE: a cloud submission costs us roughly $0.15 in Steel time, so keep the
// effective price per credit above that to stay profitable on cloud-heavy users.
// Edit freely — amounts are in the currency's subunit (kobo for NGN, cents for USD).
export type Pack = {
  id: string;
  credits: number;
  currency: "NGN" | "USD";
  amount: number; // subunit (kobo / cents)
  label: string;
  popular?: boolean;
};

// Nigeria credit packs. 1 credit tailors, 1 submits (so ~2 credits = 1 application);
// 24 credits = an interview prep session. Priced for Nigerian purchasing power —
// you pay for applications, not the tool. International uses Stripe subscriptions (later).
export const PACKS: Pack[] = [
  { id: "ngn-20", credits: 20, currency: "NGN", amount: 500_000, label: "Starter" }, // ₦5,000 ≈ 10 applications
  { id: "ngn-70", credits: 70, currency: "NGN", amount: 1_500_000, label: "Popular", popular: true }, // ₦15,000 ≈ 35 applications
  { id: "ngn-150", credits: 150, currency: "NGN", amount: 3_000_000, label: "Pro" }, // ₦30,000 ≈ 75 applications
];

export function getPack(id: string): Pack | undefined {
  return PACKS.find((p) => p.id === id);
}

const SECRET = process.env.PAYSTACK_SECRET_KEY || "";

export function paystackConfigured(): boolean {
  return SECRET.length > 0;
}

type InitResult = { authorization_url?: string; reference?: string; error?: string };

// Create a Paystack transaction and return the hosted checkout URL.
export async function initTransaction(opts: {
  email: string;
  amount: number;
  currency: "NGN" | "USD";
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<InitResult> {
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: opts.email,
      amount: opts.amount,
      currency: opts.currency,
      callback_url: opts.callbackUrl,
      metadata: opts.metadata,
    }),
  });
  const data = (await res.json()) as { status?: boolean; message?: string; data?: { authorization_url?: string; reference?: string } };
  if (!data.status || !data.data?.authorization_url) return { error: data.message || "Could not start checkout." };
  return { authorization_url: data.data.authorization_url, reference: data.data.reference };
}

// Start a recurring subscription: initialize a transaction tied to a Paystack plan
// code. Paystack charges the plan amount and creates the subscription on success.
export async function initSubscription(opts: {
  email: string;
  planCode: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<InitResult> {
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: opts.email,
      plan: opts.planCode,
      callback_url: opts.callbackUrl,
      metadata: opts.metadata,
    }),
  });
  const data = (await res.json()) as { status?: boolean; message?: string; data?: { authorization_url?: string; reference?: string } };
  if (!data.status || !data.data?.authorization_url) return { error: data.message || "Could not start subscription." };
  return { authorization_url: data.data.authorization_url, reference: data.data.reference };
}

// Paystack signs webhook bodies with HMAC-SHA512 of the raw body using the secret key.
export function verifyWebhook(rawBody: string, signature: string | null): boolean {
  if (!SECRET || !signature) return false;
  const expected = createHmac("sha512", SECRET).update(rawBody, "utf8").digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
