// Shared FAQ source of truth. Used by both the FAQ section UI and the
// FAQPage JSON-LD in app/layout.tsx — keep them driven by the same data so the
// structured data always matches the visible content (required for rich results).
export type FaqItem = { question: string; answer: string };

export const FAQS: FaqItem[] = [
  {
    question: "How does Sasa find jobs?",
    answer:
      "Sasa watches company career pages directly across Greenhouse, Lever, Ashby and remote boards, polling them every 15 minutes. The moment a new role goes live that fits your profile — role family, seniority, location, salary floor and sponsorship needs — it lands in your match feed within about 20 minutes, with a clear breakdown of why it matched. You can also paste any job URL to add it to your queue.",
  },
  {
    question: "Will recruiters know I used AI to apply?",
    answer:
      "No. Sasa tailors your CV and cover letter from your real experience and writes in your voice, with no tell-tale signatures. Every application goes out from your own browser session, exactly as if you'd submitted it yourself. The materials read like a sharper version of you — because they're built only from facts you provided.",
  },
  {
    question: "How does CV tailoring work?",
    answer:
      "For each role, Sasa reads the job description and rewrites your CV bullets and cover letter to align with the keywords and must-haves — recruiter-readable and ATS-safe. The hard rule: it may rephrase your existing experience, but it can never invent a skill, title or credential you didn't put in your profile. You see every change side-by-side and approve it before anything is sent.",
  },
  {
    question: "I need visa sponsorship — does Sasa help?",
    answer:
      "Yes. Tell Sasa which countries you need sponsorship for (UK, Canada, EU, Australia) and it filters matches against per-company sponsorship signals — drawn from public sponsor lists and job-description patterns — so you spend credits on roles that can actually hire you. Matches that assume sponsorship are labelled clearly.",
  },
  {
    question: "Is it safe to let Sasa apply from my browser?",
    answer:
      "It's the safest way. Applications submit through a Chrome extension using your own logged-in session, so we never hold your ATS passwords and there's no server-side automation that gets accounts flagged. The extension paces itself like a human, and you can pause, edit or cancel any application at any time.",
  },
  {
    question: "How does pricing work? Is there a free plan?",
    answer:
      "You buy credits, not a subscription — 1 credit = 1 application submitted, and you're only charged when it actually goes out (failed submissions are refunded automatically). Packs start at ₦5,000 for 15 applications via Paystack. Every new user starts with free credits, no card required, and the first 100 beta users get 50 free credits.",
  },
  {
    question: "How do recruiter replies get tracked?",
    answer:
      "Connect Gmail (read-only) during onboarding and Sasa routes incoming recruiter emails back to the right application automatically. Your pipeline status — applied, viewed, replied, interview, offer — updates on its own, and you get a WhatsApp ping when something needs you. We only ever read emails that match one of your applications.",
  },
];
