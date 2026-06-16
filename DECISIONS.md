# DECISIONS

Architectural and product decisions made during the build that aren't fully specified in the FRD. Newest first.

---

## 2026-06-16 — Brand name: Sasa (not Mosi)

The FRD uses "Mosi" as a working name. We're shipping as **Sasa** (Swahili for "now"), matching the existing repo/domain (`usesasa`). Positioning emphasizes "apply *now*, the moment a role drops." Replace any remaining "Mosi" references with "Sasa".

## 2026-06-16 — Landing page localized to Africa, not cloned from Tsenta

The marketing site is modeled on Tsenta's structure (the US competitor) but localized to our market:
- **WhatsApp**, not iMessage, as the primary channel.
- **NGN pricing via Paystack** (credit packs), not USD subscriptions.
- **UK Skilled Worker / Canada Express Entry / EU Blue Card** sponsorship framing, not US OPT/H-1B.
- "japa" framing and African-professional persona.

The site was bootstrapped from a v0 "developer platform" template ("Optimus"). All sections were repurposed in place — structure/animations preserved, copy and data rewritten — rather than rebuilt, to move fast. Section mapping:

| Template section | Repurposed to |
|------------------|---------------|
| Hero | "Be the first to apply to every job that fits you. Hands off." |
| Features | The 4 capabilities: find, tailor, apply, track |
| How it works | The pipeline (watch → tailor → apply → track) as a live scan feed |
| Infrastructure | Discovery coverage (sources watched, poll cadence, target regions) |
| Metrics | Product results (applications, replies, interviews, time saved) |
| Integrations | ATS sources + channels marquee |
| Security | "Trust beats autonomy" — read-only Gmail, never invents facts, you approve, delete anytime |
| Developers | Channels: WhatsApp / Web / Chrome |
| Testimonials | African professional testimonials + "where users got hired" |
| Pricing | NGN credit packs (Starter/Growth/Hunter) + free trial, NGN/USD toggle |
| Footer | Sasa footer |

> Pricing on the landing page uses the FRD §5.7.2 credit packs (₦5k/15k/35k). The "monthly/annual" toggle from the template was repurposed to an NGN/USD currency toggle, since Sasa is credit-priced, not subscription-priced.
