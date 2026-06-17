import React from "react"
import type { Metadata } from 'next'
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import {
  SITE_URL,
  SITE_NAME,
  SITE_TITLE,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  CONTACT_EMAIL,
} from '@/lib/site'
import { FAQS } from '@/lib/faq'

const instrumentSans = Instrument_Sans({ 
  subsets: ["latin"],
  variable: '--font-instrument'
});

const instrumentSerif = Instrument_Serif({ 
  subsets: ["latin"],
  weight: "400",
  variable: '--font-instrument-serif'
});

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"],
  variable: '--font-jetbrains'
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'technology',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
}

// JSON-LD structured data — helps Google show rich results for the product,
// its pricing, and the "how it works" steps.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
      email: CONTACT_EMAIL,
      description: SITE_DESCRIPTION,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'en',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#software`,
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, Chrome',
      description: SITE_DESCRIPTION,
      publisher: { '@id': `${SITE_URL}/#organization` },
      featureList: [
        'Watches 50,000+ company career pages across Greenhouse, Lever and Ashby',
        'AI-tailored CV and cover letter for every role',
        'Submits applications from your own browser via a Chrome extension',
        'Routes recruiter replies back to the right application via Gmail',
        'WhatsApp match alerts, approvals and receipts',
        'Sponsorship filtering for UK, Canada, EU and Australia',
      ],
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'NGN',
        lowPrice: '5000',
        highPrice: '100000',
        offerCount: '4',
        offers: [
          { '@type': 'Offer', name: 'Starter', price: '5000', priceCurrency: 'NGN', description: '15 applications' },
          { '@type': 'Offer', name: 'Growth', price: '15000', priceCurrency: 'NGN', description: '50 applications' },
          { '@type': 'Offer', name: 'Hunter', price: '35000', priceCurrency: 'NGN', description: '150 applications' },
          { '@type': 'Offer', name: 'Power', price: '100000', priceCurrency: 'NGN', description: '500 applications' },
        ],
      },
    },
    {
      '@type': 'HowTo',
      '@id': `${SITE_URL}/#howitworks`,
      name: 'How Sasa works',
      description: 'How Sasa applies to jobs on your behalf, from discovery to tracking.',
      step: [
        { '@type': 'HowToStep', position: 1, name: 'Find', text: 'Sasa watches thousands of company career pages and surfaces roles that fit your profile within minutes of going live.' },
        { '@type': 'HowToStep', position: 2, name: 'Tailor', text: 'It rewrites your CV and cover letter from the actual job description — rephrasing your real experience, never inventing facts.' },
        { '@type': 'HowToStep', position: 3, name: 'Apply', text: 'The Chrome extension fills the form and submits from your own logged-in browser session.' },
        { '@type': 'HowToStep', position: 4, name: 'Track', text: 'Recruiter replies route back to the right application automatically and you get a WhatsApp ping.' },
      ],
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_URL}/#faq`,
      mainEntity: FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${instrumentSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  )
}
