import { LegalPage, type LegalSection } from "@/components/legal/legal-page";

export const metadata = { title: "Privacy Policy | Sasa" };

const intro = [
  'Sasa ("Sasa", "we", "our", or "us") respects your privacy. This Privacy Policy explains how we collect, use, and protect your information when you use our website, applications, and related services (the "Services").',
  "This Policy applies to all Sasa surfaces, including the usesasa.xyz web app and dashboard, the Sasa Chrome extension, and the Sasa Telegram bot.",
  "By using Sasa, you agree to the practices described in this Privacy Policy.",
];

const sections: LegalSection[] = [
  {
    title: "1. Information We Collect",
    blocks: [
      { sub: "Information you provide" },
      {
        list: [
          "Account details (your name and email, provided through Google sign in).",
          "Resumes, cover letters, and other application materials you upload.",
          "Job preferences, work history, and answers you enter into forms.",
          "If you apply to become a mentor: your resume, LinkedIn profile, and any links you submit.",
        ],
      },
      { sub: "Information we collect automatically" },
      {
        list: [
          "Device information (operating system, browser, IP address).",
          "Usage data (features used, clicks, application activity).",
          "Log data for security and troubleshooting.",
        ],
      },
      { sub: "Email integration data" },
      {
        p: "If you connect your Gmail account, you grant read only access. We process a limited set of recent messages for two purposes only: to detect and autofill the one time passwords (OTPs) and verification links that job sites send during an application, and to match recruiter replies to the right application so your tracker stays current.",
      },
      {
        list: [
          "We do not read, permanently store, or analyze the full contents of your mailbox.",
          "Access is limited to the messages needed for those two purposes, and is processed securely.",
          "You can revoke this access at any time from your settings.",
          "We use Google user data only to provide these features. We never sell it, never use it for advertising, and never use it to train artificial intelligence or machine learning models. Our use of information received from Google APIs follows the Google API Services User Data Policy, including the Limited Use requirements.",
        ],
      },
      { sub: "AI generated content" },
      {
        p: "When you request AI assistance (for example, tailoring your CV or drafting answers to application questions), we process your input and return AI generated output.",
      },
      { sub: "Payment information" },
      { p: "Payments are handled by our payment processor. We do not collect or store your card details." },
    ],
  },
  {
    title: "2. How We Use Information",
    blocks: [
      { p: "We use your information to:" },
      {
        list: [
          "Provide and improve the Services.",
          "Tailor your CV and cover letter to a job description, on request.",
          "Draft answers to application questions, on request.",
          "Find roles that fit your profile and submit applications you approve.",
          "Detect and autofill OTPs and verification links, and match recruiter replies to the right application, when you connect Gmail.",
          "Run interview prep: when you book a session, we share the context the assigned mentor needs to run and score it.",
          "Send you updates, feature news, and support messages.",
          "Monitor usage and keep the Services secure.",
        ],
      },
      { p: "We do not sell your personal information to third parties." },
    ],
  },
  {
    title: "3. Sharing of Information",
    blocks: [
      { p: "We may share information:" },
      {
        list: [
          "With the service providers and subprocessors listed below, each receiving only what it needs to do its job.",
          "With third party job boards and applicant tracking systems when you choose to apply through Sasa.",
          "With a mentor you book for interview prep, who sees the context needed to run and score your session.",
          "For legal reasons, if required by law, court order, or to protect our rights.",
        ],
      },
      { p: "We do not share your resume or applications with recruiters or employers unless you submit them through the platform." },
      { sub: "Service providers and subprocessors" },
      {
        list: [
          "Hosting and infrastructure: Railway (application hosting and managed PostgreSQL).",
          "Authentication: Google sign in (via Better Auth) for your identity and session.",
          "AI: Anthropic (Claude) for CV and cover letter tailoring, application answers, and job fit reasoning.",
          "Cloud submission: Steel, a cloud browser that submits the applications you approve.",
          "File storage: Cloudinary, for resume and image uploads.",
          "Email: Resend for transactional email, and Google (Gmail) for read only access when you enable email integration.",
          "Messaging: Telegram, for notifications when you link the bot.",
          "Payments: Paystack, for credit packs and subscriptions.",
        ],
      },
      { p: "We may add or change subprocessors as the Services evolve. A current list is available on request by emailing founders@usesasa.xyz." },
    ],
  },
  {
    title: "4. AI Usage",
    blocks: [
      {
        list: [
          "Our AI features process your resume, the job description, and application questions to generate tailored output.",
          "You are responsible for reviewing AI generated content before you submit it to an employer.",
          "Sasa rewrites your real experience to match a role and does not invent facts, unless you explicitly turn on an option that lets it add job relevant skills.",
          "We do not use Google user data, including Gmail content, to develop, improve, or train generalized artificial intelligence or machine learning models, and we do not use it for any purpose other than the features you ask for.",
          "Inputs and outputs are processed by our AI provider (Anthropic) under its own privacy and data processing terms, and are not used to train its models.",
        ],
      },
    ],
  },
  {
    title: "5. Data Retention",
    blocks: [
      {
        list: [
          "We keep your data while your account is active.",
          "You can delete your account at any time, which removes your personal information from our active systems.",
          "Some limited data may be kept where required by law or for legitimate business needs, such as preventing fraud or resolving disputes.",
        ],
      },
    ],
  },
  {
    title: "6. Security",
    blocks: [
      { p: "We use reasonable administrative, technical, and physical safeguards to protect your information." },
      { p: "For email integration, we use secure read only access limited to detecting OTPs and verification links, and we do not keep full copies of your emails." },
      { p: "If you believe you have found a security issue affecting Sasa, please report it to founders@usesasa.xyz. We investigate every report in good faith and ask that you give us a reasonable chance to fix it before public disclosure." },
    ],
  },
  {
    title: "7. Your Rights",
    blocks: [
      { sub: "General" },
      {
        list: [
          "Access, edit, or delete your account information in your settings.",
          "Opt out of non essential messages.",
          "Delete your account, after which we remove your personal data from active systems within a reasonable period.",
          "Revoke Gmail access at any time in your settings.",
        ],
      },
      { sub: "For users in the EU and EEA (GDPR)" },
      {
        list: [
          "Access the data we hold about you.",
          "Request correction or deletion.",
          "Restrict or object to processing.",
          "Data portability.",
          "Withdraw consent for email integration.",
        ],
      },
      { sub: "For California residents (CCPA and CPRA)" },
      {
        list: [
          "Know what categories of personal information we collect, where it comes from, why we use it, and who we share it with.",
          "Access a copy of the personal information we hold.",
          "Request deletion of your personal information.",
          "Correct inaccurate personal information.",
          "Limit the use of sensitive personal information.",
          "Opt out of the sale or sharing of your personal information. We do not sell your personal information and do not share it for cross context behavioral advertising.",
          "Be free from discrimination for exercising these rights.",
        ],
      },
      { p: "To exercise any of these rights, email founders@usesasa.xyz. We verify your request using your account login and respond within the time required by law." },
    ],
  },
  {
    title: "8. Cookies and Tracking",
    blocks: [
      { p: "Sasa uses cookies and similar technologies that are strictly necessary to run the Services, such as session cookies that keep you signed in and tokens that protect against cross site request forgery. These cannot be turned off without breaking the Services." },
      { p: "We do not use third party advertising cookies and we do not take part in cross context behavioral advertising. Most browsers let you block or delete cookies, though doing so may affect how Sasa works." },
    ],
  },
  {
    title: "9. Children's Privacy",
    blocks: [
      { p: "Sasa is not directed to children under the age of 13 (or under 16 in the EU and EEA), and we do not knowingly collect their personal information. If you believe we have collected information from a child below the applicable age, please email founders@usesasa.xyz and we will delete it promptly." },
    ],
  },
  {
    title: "10. Contact",
    blocks: [
      { p: "If you have any questions about this Privacy Policy, contact us at founders@usesasa.xyz." },
    ],
  },
];

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" effectiveDate="June 23, 2026" intro={intro} sections={sections} />;
}
