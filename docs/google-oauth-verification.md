# Google OAuth Verification — Sasa (gmail.readonly)

Reference for the Google OAuth/branding verification of the restricted Gmail scope.
Copy the blocks below into the OAuth consent screen and use the script to record the
demo video.

## Scope requested

- `https://www.googleapis.com/auth/gmail.readonly` (restricted)
- Standard sign-in scopes: `openid`, `email`, `profile`

We request the single minimum restricted scope. We do **not** request `gmail.modify`,
`gmail.send`, `gmail.compose`, or full `mail.google.com`.

## Scope justification

Paste into the consent screen field "How will the scopes be used":

> Sasa is a job application assistant. Connecting Gmail is optional. When a user
> connects it, Sasa uses read only access for two narrow purposes during that user's
> own job applications:
>
> 1. Detect the one time passwords (OTPs) and verification links that job sites and
>    applicant tracking systems email during sign up or submission, so Sasa can
>    autofill them and complete the application the user started.
> 2. Match recruiter replies to the user's tracked applications so the application
>    tracker stays current.
>
> Sasa reads only the messages needed for these two purposes. It never reads, stores,
> or analyzes the rest of the mailbox, never sends email, and never modifies the
> mailbox. gmail.readonly is the minimum scope that allows reading message content for
> these messages; no narrower read scope exists. The user grants access explicitly and
> can revoke it at any time from settings.

## How Google user data is used (summary)

- **Read only.** Detect OTP/verification messages and match recruiter replies. No
  sending, no modifying, no full-inbox analysis.
- **Storage.** We store only what is tied to an application (a detected code while a
  submission is in flight, or a reply matched to an application). We do not retain full
  message bodies beyond what is needed.
- **Sharing.** Gmail content is not shared with third parties. Our LLM provider
  (Anthropic) is used for CV tailoring and answers, not for reading the inbox.

## Limited Use statement (required)

Include this on the privacy page and/or in the justification:

> Sasa's use and transfer of information received from Google APIs to any other app
> will adhere to the Google API Services User Data Policy, including the Limited Use
> requirements.

## Demo video script (record an unlisted YouTube video, 1 to 3 minutes)

Record a screen capture, narrating each step and naming exactly what data is accessed
and why. Show, in order:

1. Open `https://usesasa.xyz` — the homepage that explains what Sasa does (5 to 10s).
2. Sign in, go to Settings, then Email integration. Show the "Connect Gmail" action and
   the on-page note that access is read only and used for OTP detection plus reply
   matching.
3. Click Connect and show the **real Google OAuth consent screen** — the app name
   "Sasa", the `gmail.readonly` scope, and the user granting it. This shot is required.
4. Back in Sasa, show a real use: submit an application that triggers a verification
   code and show Sasa detecting and autofilling it; then show a recruiter reply landing
   on the correct application in the tracker.
5. Show Settings and disconnect/revoke Gmail, proving the user can turn it off.
6. Show the Privacy Policy at `usesasa.xyz/privacy` and the section describing Gmail use.

## Pre-submission checklist

- [ ] Homepage live, public, explains the app, links the privacy policy (done).
- [ ] Privacy policy live at `usesasa.xyz/privacy`, describes Gmail use, matches the
      homepage wording (done).
- [ ] Consent screen: app name "Sasa", homepage `https://usesasa.xyz`, privacy
      `https://usesasa.xyz/privacy` (identical to the footer link).
- [ ] `usesasa.xyz` verified in Google Search Console under the same Google account as
      the Cloud project, and listed under Authorized domains.
- [ ] Limited Use statement present.
- [ ] Demo video (unlisted YouTube) link added to the submission.

## Likely follow-up

Restricted scopes in production usually also require a **CASA security assessment**
(Tier 2), repeated annually, through a Google-approved assessor. Branding/consent
verification is the first gate; the security assessment can follow.
