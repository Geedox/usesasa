import { NextResponse } from "next/server";

// Resolve the visitor's country server-side (no browser CORS, uses the real
// client IP from the proxy headers). Returns { country: "NG" | ... | null }.
// Used by the landing page to pick Naira vs USD pricing.
export async function GET(req: Request) {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const ip = xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "";

  const country = (await lookupCountryIs(ip)) ?? (await lookupIpwhois(ip));

  return NextResponse.json(
    { country },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}

async function lookupCountryIs(ip: string): Promise<string | null> {
  try {
    const r = await fetch(`https://api.country.is/${ip}`, { headers: { "User-Agent": "sasa" } });
    if (!r.ok) return null;
    const d = (await r.json()) as { country?: string };
    return d.country ?? null;
  } catch {
    return null;
  }
}

async function lookupIpwhois(ip: string): Promise<string | null> {
  try {
    const r = await fetch(`https://ipwho.is/${ip}?fields=country_code,success`, { headers: { "User-Agent": "sasa" } });
    if (!r.ok) return null;
    const d = (await r.json()) as { country_code?: string };
    return d.country_code ?? null;
  } catch {
    return null;
  }
}
