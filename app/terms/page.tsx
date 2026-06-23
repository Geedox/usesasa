import { LegalPage, type LegalSection } from "@/components/legal/legal-page";

export const metadata = { title: "Terms of Service | Sasa" };

const intro = [
  'Welcome to Sasa. These Terms of Service ("Terms") govern your use of our website, applications, and services (together, the "Services"). By accessing or using Sasa, you agree to be bound by these Terms.',
  "If you do not agree to these Terms, please do not use the Services.",
];

const sections: LegalSection[] = [
  {
    title: "1. Acceptance of Terms",
    blocks: [
      { p: "By creating an account or using Sasa, you confirm that you are at least 18 years old and have the legal capacity to enter into these Terms. If you use Sasa on behalf of an organization, you confirm that you have authority to bind that organization." },
    ],
  },
  {
    title: "2. Description of Services",
    blocks: [
      { p: "Sasa is a job application agent that helps you:" },
      {
        list: [
          "Discover roles across company career pages and job boards.",
          "Upload and manage your resumes and application materials.",
          "Tailor your CV and cover letter to a role with AI.",
          "Apply to jobs, either through our Chrome extension from your own browser or through our cloud browser when you approve a submission.",
          "Track your applications and get notifications on Telegram.",
          "Book mock interviews with senior mentors and receive honest feedback and a score (interview prep).",
        ],
      },
    ],
  },
  {
    title: "3. Accounts and Responsibilities",
    blocks: [
      { sub: "Account security" },
      {
        list: [
          "You are responsible for keeping your login credentials confidential.",
          "Tell us immediately about any unauthorized use of your account.",
          "You are responsible for activity that happens under your account.",
        ],
      },
      { sub: "Accurate information" },
      { p: "You agree to give accurate, current, and complete information, and to keep it up to date." },
      { sub: "Prohibited conduct" },
      { p: "You agree not to:" },
      {
        list: [
          "Use the Services for any illegal or unauthorized purpose.",
          "Break any laws that apply to you.",
          "Impersonate any person or entity.",
          "Upload false, misleading, or fraudulent information.",
          "Try to gain unauthorized access to our systems or another user's account.",
          "Interfere with or disrupt the Services or servers.",
          "Use bots or scripts to access the Services in ways we did not intend.",
          "Scrape, copy, or redistribute content from the Services without permission.",
        ],
      },
    ],
  },
  {
    title: "4. Credits, Subscriptions, and Payments",
    blocks: [
      {
        list: [
          "Some features cost credits (for example, tailoring your CV and cover letter, or submitting an application) or are included in a subscription, depending on your region.",
          "Credits are prepaid. Unless stated otherwise, credits expire 30 days after they are added if they are not used.",
          "Payments are processed by our payment processor (Paystack). The price and what each plan or pack includes are shown at the time of purchase.",
          "Referral rewards are granted according to the program rules, which we may change.",
          "We may change prices, credit costs, and plan features. Changes apply going forward, not to purchases you already made.",
        ],
      },
    ],
  },
  {
    title: "5. AI Generated Content",
    blocks: [
      {
        list: [
          "Sasa may use AI to help generate or tailor resumes, cover letters, and application answers.",
          "You are solely responsible for reviewing and approving all AI generated content before you submit it to an employer.",
          "We do not guarantee the accuracy, completeness, or suitability of AI generated content.",
          "Sasa rewrites your real experience and does not invent facts, unless you explicitly enable an option that lets it add job relevant skills.",
          "AI generated content is a tool to assist you. You keep full responsibility for your applications.",
        ],
      },
    ],
  },
  {
    title: "6. Interview Prep and Mentors",
    blocks: [
      {
        list: [
          "Mentors are independent professionals who run mock interviews and give feedback.",
          "Feedback and scores are opinions meant to help you prepare. They are not a promise of any job, interview, or outcome.",
          "Booking a session costs credits. Cancellation and refund terms are shown when you book.",
          "You agree to treat mentors with respect and to use sessions only for genuine interview practice.",
        ],
      },
    ],
  },
  {
    title: "7. Intellectual Property",
    blocks: [
      { sub: "Our content" },
      { p: "All content, features, and functionality of the Services, including software, text, graphics, logos, and designs, are owned by Sasa or its licensors and are protected by intellectual property laws." },
      { sub: "Your content" },
      { p: "You keep ownership of the content you upload, such as resumes and cover letters. By uploading content, you grant us a limited license to:" },
      {
        list: [
          "Store, process, and display your content as needed to provide the Services.",
          "Use your content to generate AI suggestions and improvements.",
          "Submit your content to job boards and employers when you choose to apply through Sasa.",
        ],
      },
    ],
  },
  {
    title: "8. Email Integration",
    blocks: [
      {
        list: [
          "If you connect your email, we access it only to detect and autofill one time passwords and verification links.",
          "We do not read, store, or analyze the full contents of your emails.",
          "You can revoke email access at any time in your settings.",
          "See our Privacy Policy for more detail.",
        ],
      },
    ],
  },
  {
    title: "9. Third Party Services",
    blocks: [
      { p: "Sasa works with third party job boards, applicant tracking systems, payment processors, and messaging platforms. We are not responsible for the content, policies, or practices of these third parties. Your use of them is subject to their own terms." },
    ],
  },
  {
    title: "10. Disclaimer of Warranties",
    blocks: [
      { p: 'THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING:' },
      {
        list: [
          "Warranties of merchantability, fitness for a particular purpose, or non infringement.",
          "That the Services will be uninterrupted, secure, or free of errors.",
          "Any guarantee of job placement, interviews, or employment.",
          "The accuracy or reliability of AI generated content.",
        ],
      },
    ],
  },
  {
    title: "11. Limitation of Liability",
    blocks: [
      { p: "TO THE MAXIMUM EXTENT PERMITTED BY LAW, SASA IS NOT LIABLE FOR:" },
      {
        list: [
          "Any indirect, incidental, special, consequential, or punitive damages.",
          "Loss of profits, revenue, data, or business opportunities.",
          "Damages from your use of or inability to use the Services.",
          "Errors in AI generated content.",
          "Acts or omissions of third party job boards or employers.",
        ],
      },
    ],
  },
  {
    title: "12. Indemnification",
    blocks: [
      { p: "You agree to indemnify, defend, and hold harmless Sasa and its officers, directors, employees, and agents from any claims, liabilities, damages, losses, or expenses (including reasonable legal fees) arising from your use of the Services, your breach of these Terms, or your infringement of another party's rights." },
    ],
  },
  {
    title: "13. Termination",
    blocks: [
      { p: "We may suspend or terminate your account and access to the Services at any time, with or without notice, for:" },
      {
        list: [
          "Breach of these Terms.",
          "Fraudulent or illegal activity.",
          "Conduct we believe is harmful to Sasa, other users, or third parties.",
        ],
      },
      { p: "You may close your account at any time by contacting us or using the account deletion feature. When your account ends, your right to use the Services ends immediately." },
    ],
  },
  {
    title: "14. Changes to These Terms",
    blocks: [
      { p: "We may update these Terms at any time by posting the new version on our website. If you keep using the Services after changes are posted, you accept the updated Terms. Please review them from time to time." },
    ],
  },
  {
    title: "15. Governing Law and Disputes",
    blocks: [
      { p: "These Terms are governed by the laws of the Federal Republic of Nigeria, without regard to conflict of law principles. Any dispute arising from these Terms or your use of the Services will be handled by the courts of Nigeria, except where the law requires otherwise." },
    ],
  },
  {
    title: "16. Miscellaneous",
    blocks: [
      {
        list: [
          "Entire agreement: These Terms and our Privacy Policy are the entire agreement between you and Sasa.",
          "Severability: If any part of these Terms is unenforceable, the rest stays in effect.",
          "Waiver: If we do not enforce a right, that is not a waiver of it.",
          "Assignment: You may not transfer these Terms without our written consent. We may assign them without restriction.",
        ],
      },
    ],
  },
  {
    title: "17. Contact",
    blocks: [
      { p: "Questions about these Terms? Contact us at founders@usesasa.xyz." },
      { p: "By using Sasa, you confirm that you have read, understood, and agree to these Terms of Service." },
    ],
  },
];

export default function TermsPage() {
  return <LegalPage title="Terms of Service" effectiveDate="June 23, 2026" intro={intro} sections={sections} />;
}
