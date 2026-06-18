"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 1.7 14.7.8 12 .8 5.9.8 1 5.7 1 11.8s4.9 11 11 11c6.4 0 10.6-4.5 10.6-10.8 0-.7-.1-1.3-.2-1.8H12z"
      />
      <path
        fill="#4285F4"
        d="M22.6 12c0-.7-.1-1.3-.2-1.8H12v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1v3.8c6.4 0 10.6-4.5 10.6-10z"
      />
      <path
        fill="#FBBC05"
        d="M5.99 14.1A6.1 6.1 0 0 1 5.7 12c0-.73.13-1.43.29-2.1V6.04H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.96l3.81-2.86z"
      />
      <path
        fill="#34A853"
        d="M12 22.8c2.7 0 4.97-.9 6.62-2.43l-3.23-2.5c-.86.6-2.02 1.02-3.39 1.02-3.8 0-5.26-2.7-5.5-4.1l-3.8 2.86C2.96 20.13 7.06 22.8 12 22.8z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/onboarding",
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not sign in with Google.",
      );
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <Link href="/" className="font-display text-2xl block mb-8">
          Sasa
        </Link>

        <h1 className="font-display text-3xl tracking-tight mb-2">
          Welcome to Sasa
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Sign in to start automating your job applications.
        </p>

        <Button
          type="button"
          onClick={onGoogle}
          disabled={loading}
          variant="outline"
          className="w-full h-12 rounded-full border-foreground/20 hover:bg-foreground/5 cursor-pointer"
        >
          {loading ? (
            "Redirecting…"
          ) : (
            <>
              <GoogleIcon className="w-5 h-5" />
              Continue with Google
            </>
          )}
        </Button>

        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

        <p className="text-xs text-muted-foreground mt-8 leading-relaxed">
          We only ask for your basic Google profile to sign you in. Permission
          to read recruiter replies is requested later, separately — never at
          sign-in.
        </p>
      </div>
    </main>
  );
}
