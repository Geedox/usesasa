"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? undefined, // same-origin by default
  plugins: [emailOTPClient()],
});

export const { signIn, signUp, signOut, useSession, emailOtp, forgetPassword } = authClient;
