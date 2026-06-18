import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import { users, sessions, accounts, verifications } from "@/lib/db/schema";
import { sendEmail, buildWelcomeEmail } from "@/lib/email";

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
          const { subject, text, html } = buildWelcomeEmail(user.name);
          await sendEmail({ to: user.email, subject, text, html });
        },
      },
    },
  },

  // Google OAuth only. Better Auth requests just openid/email/profile by default
  // (NO gmail.readonly — FR-002 / Constitution IV). Gmail is a separate later step.
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
});
