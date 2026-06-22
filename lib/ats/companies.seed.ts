import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";

// Companies with active Greenhouse boards (validated live against the API).
export const GREENHOUSE_SLUGS: { slug: string; name: string }[] = [
  { slug: "affirm", name: "Affirm" },
  { slug: "airbnb", name: "Airbnb" },
  { slug: "airtable", name: "Airtable" },
  { slug: "algolia", name: "Algolia" },
  { slug: "amplitude", name: "Amplitude" },
  { slug: "anthropic", name: "Anthropic" },
  { slug: "asana", name: "Asana" },
  { slug: "betterment", name: "Betterment" },
  { slug: "brex", name: "Brex" },
  { slug: "calendly", name: "Calendly" },
  { slug: "calm", name: "Calm" },
  { slug: "chime", name: "Chime" },
  { slug: "cloudflare", name: "Cloudflare" },
  { slug: "cockroachlabs", name: "Cockroach Labs" },
  { slug: "coinbase", name: "Coinbase" },
  { slug: "contentful", name: "Contentful" },
  { slug: "coursera", name: "Coursera" },
  { slug: "databricks", name: "Databricks" },
  { slug: "datadog", name: "Datadog" },
  { slug: "discord", name: "Discord" },
  { slug: "dropbox", name: "Dropbox" },
  { slug: "duolingo", name: "Duolingo" },
  { slug: "faire", name: "Faire" },
  { slug: "figma", name: "Figma" },
  { slug: "fivetran", name: "Fivetran" },
  { slug: "gitlab", name: "GitLab" },
  { slug: "gocardless", name: "GoCardless" },
  { slug: "grafanalabs", name: "Grafana Labs" },
  { slug: "gusto", name: "Gusto" },
  { slug: "instacart", name: "Instacart" },
  { slug: "lattice", name: "Lattice" },
  { slug: "launchdarkly", name: "LaunchDarkly" },
  { slug: "lithic", name: "Lithic" },
  { slug: "lyft", name: "Lyft" },
  { slug: "marqeta", name: "Marqeta" },
  { slug: "mercury", name: "Mercury" },
  { slug: "mongodb", name: "MongoDB" },
  { slug: "monzo", name: "Monzo" },
  { slug: "nextdoor", name: "Nextdoor" },
  { slug: "oura", name: "Oura" },
  { slug: "paystack", name: "Paystack" },
  { slug: "peloton", name: "Peloton" },
  { slug: "pinterest", name: "Pinterest" },
  { slug: "planetscale", name: "PlanetScale" },
  { slug: "postman", name: "Postman" },
  { slug: "reddit", name: "Reddit" },
  { slug: "remotecom", name: "Remote" },
  { slug: "robinhood", name: "Robinhood" },
  { slug: "samsara", name: "Samsara" },
  { slug: "scaleai", name: "Scale AI" },
  { slug: "sofi", name: "SoFi" },
  { slug: "squarespace", name: "Squarespace" },
  { slug: "stripe", name: "Stripe" },
  { slug: "twilio", name: "Twilio" },
  { slug: "twitch", name: "Twitch" },
  { slug: "udemy", name: "Udemy" },
  { slug: "webflow", name: "Webflow" },
  { slug: "gitlab", name: "GitLab" },
  { slug: "vercel", name: "Vercel" },
  { slug: "postman", name: "Postman" },
  { slug: "netlify", name: "Netlify" },
  { slug: "mixpanel", name: "Mixpanel" },
  { slug: "circleci", name: "CircleCI" },
  { slug: "mattermost", name: "Mattermost" },
  { slug: "planetscale", name: "PlanetScale" },
  { slug: "turing", name: "Turing" },
  { slug: "remote", name: "Remote" },
  { slug: "paystack", name: "Paystack" },
  { slug: "moniepoint", name: "Moniepoint" },
];

// Companies with active Lever boards (validated live).
export const LEVER_SLUGS: { slug: string; name: string }[] = [
  { slug: "gopuff", name: "Gopuff" },
  { slug: "mistral", name: "Mistral AI" },
  { slug: "outreach", name: "Outreach" },
  { slug: "ro", name: "Ro" },
  { slug: "spotify", name: "Spotify" },
  { slug: "nium", name: "Nium" }, // from the Nigeria/Africa list (verified live)
];

// Companies with active Ashby boards (validated live).
export const ASHBY_SLUGS: { slug: string; name: string }[] = [
  { slug: "ashby", name: "Ashby" },
  { slug: "baseten", name: "Baseten" },
  { slug: "browserbase", name: "Browserbase" },
  { slug: "character", name: "Character.AI" },
  { slug: "cohere", name: "Cohere" },
  { slug: "cursor", name: "Cursor" },
  { slug: "inngest", name: "Inngest" },
  { slug: "linear", name: "Linear" },
  { slug: "mercor", name: "Mercor" },
  { slug: "mintlify", name: "Mintlify" },
  { slug: "modal", name: "Modal" },
  { slug: "neon", name: "Neon" },
  { slug: "notion", name: "Notion" },
  { slug: "openai", name: "OpenAI" },
  { slug: "perplexity", name: "Perplexity" },
  { slug: "posthog", name: "PostHog" },
  { slug: "railway", name: "Railway" },
  { slug: "ramp", name: "Ramp" },
  { slug: "replit", name: "Replit" },
  { slug: "resend", name: "Resend" },
  { slug: "runway", name: "Runway" },
  { slug: "sieve", name: "Sieve" },
  { slug: "supabase", name: "Supabase" },
  { slug: "warp", name: "Warp" },
  { slug: "watershed", name: "Watershed" },
  { slug: "zed", name: "Zed" },
  { slug: "zapier", name: "Zapier" },
  { slug: "confluent", name: "Confluent" },
  { slug: "temporal", name: "Temporal" },
  { slug: "sentry", name: "Sentry" },
  { slug: "render", name: "Render" },
  { slug: "andela", name: "Andela" },
  { slug: "mux", name: "Mux" },
  // From the Nigeria/Africa career-page list (detected + verified live).
  { slug: "m-kopa", name: "M-KOPA" },
  { slug: "payscale", name: "Payscale" },
  { slug: "close", name: "Close" },
];

// Companies with SmartRecruiters boards (validated live; identifiers are case-sensitive).
export const SMARTRECRUITERS_SLUGS: { slug: string; name: string }[] = [
  { slug: "BoschGroup", name: "Bosch" },
  { slug: "SGS", name: "SGS" },
  { slug: "Wabtec", name: "Wabtec" },
  { slug: "Experian", name: "Experian" },
  { slug: "Accor", name: "Accor" },
  { slug: "NielsenIQ", name: "NielsenIQ" },
  { slug: "Sodexo", name: "Sodexo" },
  { slug: "SmartRecruiters", name: "SmartRecruiters" },
  { slug: "Visa", name: "Visa" },
];

// Workday tenants. The slug encodes "tenant|host|site" (Workday needs all three).
// Workday is enterprise/mega-cap heavy (low odds for this audience), so we seed
// none by default. Add only verified mid-size tenants here as "tenant|host|site".
export const WORKDAY_SLUGS: { slug: string; name: string }[] = [
  // From the Nigeria/Africa career-page list (detected + verified live).
  { slug: "scj|scj.wd5.myworkdayjobs.com|External_Career_Site", name: "SC Johnson" },
  { slug: "mastercardfoundation|mastercardfoundation.wd10.myworkdayjobs.com|mastercardfdn", name: "Mastercard Foundation" },
  { slug: "visa|visa.wd5.myworkdayjobs.com|Visa", name: "Visa" },
];

// Companies with active Workable boards (validated live; slug = the workable account).
export const WORKABLE_SLUGS: { slug: string; name: string }[] = [
  { slug: "kuda", name: "Kuda" },
  { slug: "remotebase", name: "Remotebase" },
  { slug: "helium-health", name: "Helium Health" },
  // Nigeria/Africa batch (best-effort slugs; an empty/unknown board simply returns
  // 0 and is harmless). The aggregators below carry the broad local + intern volume.
  { slug: "moniepoint", name: "Moniepoint" },
  { slug: "grey", name: "Grey" },
  { slug: "mono", name: "Mono" },
  { slug: "fairmoney", name: "FairMoney" },
  { slug: "carbon", name: "Carbon" },
  { slug: "lemfi", name: "LemFi" },
  { slug: "nomba", name: "Nomba" },
  { slug: "sabi", name: "Sabi" },
  { slug: "vendease", name: "Vendease" },
  { slug: "bamboo", name: "Bamboo" },
];

// Teamtailor accounts (slug = the teamtailor subdomain). Populated from the
// career-page detector as real accounts are found.
export const TEAMTAILOR_SLUGS: { slug: string; name: string }[] = [];

// Recruitee accounts (slug = the recruitee subdomain).
export const RECRUITEE_SLUGS: { slug: string; name: string }[] = [
  { slug: "channable", name: "Channable" },
];

// BambooHR accounts (slug = the bamboohr subdomain).
export const BAMBOOHR_SLUGS: { slug: string; name: string }[] = [
  { slug: "klipfolio", name: "Klipfolio" },
  { slug: "raenest", name: "Raenest" }, // from the Nigeria/Africa list (verified live)
];

// Idempotent: insert any missing watched companies across all ATSes. Returns all.
export async function seedCompanies() {
  const rows = [
    ...GREENHOUSE_SLUGS.map((c) => ({ name: c.name, ats: "greenhouse" as const, atsSlug: c.slug })),
    ...LEVER_SLUGS.map((c) => ({ name: c.name, ats: "lever" as const, atsSlug: c.slug })),
    ...ASHBY_SLUGS.map((c) => ({ name: c.name, ats: "ashby" as const, atsSlug: c.slug })),
    ...SMARTRECRUITERS_SLUGS.map((c) => ({ name: c.name, ats: "smartrecruiters" as const, atsSlug: c.slug })),
    ...WORKDAY_SLUGS.map((c) => ({ name: c.name, ats: "workday" as const, atsSlug: c.slug })),
    ...WORKABLE_SLUGS.map((c) => ({ name: c.name, ats: "workable" as const, atsSlug: c.slug })),
    ...TEAMTAILOR_SLUGS.map((c) => ({ name: c.name, ats: "teamtailor" as const, atsSlug: c.slug })),
    ...RECRUITEE_SLUGS.map((c) => ({ name: c.name, ats: "recruitee" as const, atsSlug: c.slug })),
    ...BAMBOOHR_SLUGS.map((c) => ({ name: c.name, ats: "bamboohr" as const, atsSlug: c.slug })),
  ];
  await db
    .insert(companies)
    .values(rows)
    .onConflictDoNothing({ target: [companies.ats, companies.atsSlug] });

  return db.query.companies.findMany();
}
