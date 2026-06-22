import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import { users, sessions, accounts, verifications } from "@/lib/db/schema";
import { sendEmail, buildWelcomeEmail } from "@/lib/email";
import { ensureReferralCode } from "@/lib/referral";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",

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
          const { subject, text, html } = buildWelcomeEmail(user.name);
          await sendEmail({ to: user.email, subject, text, html });
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
