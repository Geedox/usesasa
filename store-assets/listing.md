# Chrome Web Store listing — Sasa

Paste each value into the matching field in the Developer Dashboard.

## Product details

**Title:** Sasa

**Summary (132 char max):**
Apply to jobs, hands off. Submits your queued applications from your own browser.

**Category:** Workflow and planning

**Language:** English (United Kingdom)

---

## Description

Sasa applies to jobs for you, without taking your hands off the wheel.

Line up the roles you want. Sasa fills the application, tailors your CV and cover letter to each job, and queues everything inside your own browser. You review and approve, then it submits. Nothing is ever sent without you.

WHAT SASA DOES

• Universal autofill. One click fills your name, contact, work history, links, and the screening questions that usually slow you down, on any career page.

• Tailored for every role. Sasa rewrites your CV and drafts a cover letter to match each job description, so every application reads like you wrote it for that company.

• You always approve. Every application waits for your review. Read it, edit it, then approve to submit. Sasa never sends on its own.

• Match scores. See how well you fit a role before you spend time on it.

• One place to track. Top matches, drafts, queued, and submitted applications live in a single dashboard, with your credits and status at a glance.

WORKS WHERE YOU APPLY

Greenhouse, Lever, Ashby, Workday, and any other career page on the web. If there is a form, Sasa can fill it.

HOW IT WORKS

1. Create your Sasa profile once at usesasa.xyz.
2. Open any job you like and the Sasa widget appears.
3. Click Quick fill to complete the form, or Tailor and queue to get a tailored CV and cover letter.
4. Review the application and approve. Sasa submits it for you.

PRIVACY YOU CONTROL

Sasa fills forms from the profile you set up. It runs in your own browser and only acts on the pages you open. We never sell your data, and we never submit anything without your approval.

Get started free at usesasa.xyz.

---

## Additional fields

**Official URL / Homepage URL:** https://usesasa.xyz

**Support URL:** https://usesasa.xyz/support
(Note: this field must be a URL, not an email. If you do not have a support page,
use mailto:support@usesasa.xyz, or point it at https://usesasa.xyz for now.)

---

## Graphic assets (files in this folder)

| Store field            | Required size   | File                          |
|------------------------|-----------------|-------------------------------|
| Store icon             | 128 x 128 PNG   | store-icon-128.png            |
| Screenshots (up to 5)  | 1280 x 800 JPEG | screenshot-1.jpg … screenshot-5.jpg |
| Small promo tile       | 440 x 280 JPEG  | promo-small-440x280.jpg       |
| Marquee promo tile     | 1400 x 560 JPEG | promo-marquee-1400x560.jpg    |

All screenshots and promo tiles are JPEG (RGB, no alpha) to satisfy the store's
"24-bit PNG (no alpha) or JPEG" rule. The store icon is 128x128 RGB PNG.

---

## Permission justification (Privacy practices tab)

- host_permissions "https://*/*": Sasa is a universal job-application autofill.
  Employers host applications on their own ATS domains (Greenhouse, Lever, Ashby,
  Workday, and countless custom career pages), which are not a fixed list, so the
  extension needs access to any https page to detect and fill an application form.
- tabs / webNavigation / scripting: detect when the active tab is a job application
  page and inject the autofill widget.
- storage: cache the signed-in session and profile locally so the widget can fill
  forms without re-fetching on every page.
- alarms: periodic sync of the user's application queue.

Single purpose: help a signed-in user fill and queue job applications, which the
user then reviews and approves. The extension does not submit anything without
explicit user approval.
