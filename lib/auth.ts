import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { db } from "@/lib/db";
import { users, sessions, accounts, verifications } from "@/lib/db/schema";
import { sendEmail, buildWelcomeEmail, buildOtpEmail } from "@/lib/email";
import { ensureReferralCode } from "@/lib/referral";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",

  // Email + password sign-in. Email must be verified (via a one time code, below)
  // before a password login works. Password reset is also code based (no links).
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
  },

  // One time codes for email verification, password reset, and OTP sign-in.
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600, // 10 minutes
      async sendVerificationOTP({ email, otp, type }) {
        const { subject, text, html } = buildOtpEmail(otp, type);
        await sendEmail({ to: email, subject, text, html });
      },
    }),
  ],

  // Use our existing Drizzle/Postgres schema. Map Better Auth's models to our tables.
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),

  // Let Postgres generate uuids (so domain FKs stay uuid); don't generate string ids.
  advanced: {
    database: { generateId: false },
  },

  // Send a welcome email on first signup (when the user record is created).
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Generate the user's permanent referral code once, at signup.
          await ensureReferralCode(user.id).catch((e) => console.error("[referral] code gen failed:", e));
          // Welcome email is best-effort: never let it affect sign-up.
          try {
            const { subject, text, html } = buildWelcomeEmail(user.name);
            await sendEmail({ to: user.email, subject, text, html });
          } catch (e) {
            console.error("[welcome-email] send failed:", e);
          }
        },
      },
    },
  },

  // Allow re-linking the same Google account so we can request extra scopes
  // (gmail.readonly) on top of the login grant via authClient.linkSocial().
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },

  // Google OAuth only. Login requests just openid/email/profile; gmail.readonly is
  // requested separately (and incrementally) from the Email Integrations settings.
  // accessType "offline" so the extra-scope grant returns a refresh token.
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      accessType: "offline",
    },
  },
});
