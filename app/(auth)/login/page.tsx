"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "signin" | "signup" | "verify" | "forgot" | "reset";

// Google sign-in is temporarily disabled while Google OAuth verification is pending.
// To re-enable: uncomment the GoogleIcon, the onGoogle handler, and the button below.
// function GoogleIcon({ className }: { className?: string }) {
//   return (
//     <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
//       <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 1.7 14.7.8 12 .8 5.9.8 1 5.7 1 11.8s4.9 11 11 11c6.4 0 10.6-4.5 10.6-10.8 0-.7-.1-1.3-.2-1.8H12z" />
//       <path fill="#4285F4" d="M22.6 12c0-.7-.1-1.3-.2-1.8H12v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1v3.8c6.4 0 10.6-4.5 10.6-10z" />
//       <path fill="#FBBC05" d="M5.99 14.1A6.1 6.1 0 0 1 5.7 12c0-.73.13-1.43.29-2.1V6.04H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.96l3.81-2.86z" />
//       <path fill="#34A853" d="M12 22.8c2.7 0 4.97-.9 6.62-2.43l-3.23-2.5c-.86.6-2.02 1.02-3.39 1.02-3.8 0-5.26-2.7-5.5-4.1l-3.8 2.86C2.96 20.13 7.06 22.8 12 22.8z" />
//     </svg>
//   );
// }

const TITLES: Record<Mode, { title: string; subtitle: string }> = {
  signin: { title: "Welcome back", subtitle: "Sign in to keep your applications moving." },
  signup: { title: "Create your account", subtitle: "Start automating your job applications." },
  verify: { title: "Verify your email", subtitle: "Enter the 6 digit code we emailed you." },
  forgot: { title: "Reset your password", subtitle: "We will email you a code to reset it." },
  reset: { title: "Set a new password", subtitle: "Enter the code we emailed and your new password." },
};

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const clear = () => { setError(""); setInfo(""); };
  const switchMode = (m: Mode) => { clear(); setMode(m); };
  const go = (url: string) => { window.location.href = url; };
  const errMsg = (e: unknown, fallback: string): string => {
    if (e && typeof e === "object" && "message" in e) {
      const m = (e as { message?: unknown }).message;
      if (typeof m === "string" && m) return m;
    }
    return fallback;
  };

  // Google sign-in (disabled — see note above).
  // const onGoogle = async () => {
  //   clear(); setLoading(true);
  //   try { await authClient.signIn.social({ provider: "google", callbackURL: "/onboarding" }); }
  //   catch (e) { setError(errMsg(e, "Could not sign in with Google.")); setLoading(false); }
  // };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Paint the loading state synchronously so the spinner is always visible, even
    // when the action resolves and navigates away quickly (e.g. verify -> onboarding).
    flushSync(() => { setError(""); setInfo(""); setLoading(true); });
    try {
      if (mode === "signup") {
        const { error: err } = await authClient.signUp.email({ name, email, password });
        if (err) return setError(errMsg(err, "Could not create your account."));
        const { error: otpErr } = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
        if (otpErr) return setError(errMsg(otpErr, "Could not send the code."));
        setInfo(`We sent a 6 digit code to ${email}.`);
        setMode("verify");
      } else if (mode === "signin") {
        const { error: err } = await authClient.signIn.email({ email, password });
        if (err) {
          const code = (err as { code?: string }).code || "";
          if (code === "EMAIL_NOT_VERIFIED" || /verif/i.test(errMsg(err, ""))) {
            await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
            setInfo(`Your email is not verified yet. We sent a code to ${email}.`);
            return setMode("verify");
          }
          return setError(errMsg(err, "Could not sign in. Check your email and password."));
        }
        go("/onboarding");
      } else if (mode === "verify") {
        const { error: err } = await authClient.emailOtp.verifyEmail({ email, otp });
        if (err) return setError(errMsg(err, "Invalid or expired code."));
        // Email is verified now. Sign in with the password just set so the user lands
        // in onboarding instead of bouncing back to an empty login form.
        if (password) {
          const { error: signErr } = await authClient.signIn.email({ email, password });
          if (signErr) {
            setInfo("Email verified. Please sign in.");
            return setMode("signin");
          }
          return go("/onboarding");
        }
        setInfo("Email verified. Please sign in.");
        setMode("signin");
      } else if (mode === "forgot") {
        const { error: err } = await authClient.forgetPassword.emailOtp({ email });
        if (err) return setError(errMsg(err, "Could not send the code."));
        setPassword("");
        setInfo(`We sent a reset code to ${email}.`);
        setMode("reset");
      } else if (mode === "reset") {
        const { error: err } = await authClient.emailOtp.resetPassword({ email, otp, password });
        if (err) return setError(errMsg(err, "Could not reset your password."));
        setOtp("");
        setInfo("Password updated. Sign in with your new password.");
        setMode("signin");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    clear();
    try {
      if (mode === "reset") await authClient.forgetPassword.emailOtp({ email });
      else await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
      setInfo("A new code is on its way.");
    } catch {
      setError("Could not resend the code.");
    }
  };

  const { title, subtitle } = TITLES[mode];

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-display text-2xl block mb-8 text-center">Sasa</Link>

        <h1 className="font-display text-3xl tracking-tight mb-2 text-center">{title}</h1>
        <p className="text-sm text-muted-foreground mb-8 text-center">{subtitle}</p>

        <form onSubmit={submit} className="space-y-4 text-left">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" required />
            </div>
          )}

          {(mode === "signin" || mode === "signup" || mode === "forgot") && (
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" required />
            </div>
          )}

          {(mode === "verify" || mode === "reset") && (
            <div className="space-y-1.5">
              <Label htmlFor="otp">Verification code</Label>
              <Input id="otp" inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6 digit code" required />
            </div>
          )}

          {(mode === "signin" || mode === "signup") && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "signin" && (
                  <button type="button" onClick={() => switchMode("forgot")} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                    Forgot password?
                  </button>
                )}
              </div>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "At least 8 characters" : "Your password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={8} />
            </div>
          )}

          {mode === "reset" && (
            <div className="space-y-1.5">
              <Label htmlFor="newpw">New password</Label>
              <Input id="newpw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" required minLength={8} />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-emerald-600">{info}</p>}

          <Button type="submit" disabled={loading} className="w-full h-12 rounded-full bg-foreground text-background hover:bg-foreground/90 cursor-pointer disabled:opacity-100">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Please wait…
              </span>
            ) : (
              mode === "signin" ? "Sign in" :
              mode === "signup" ? "Create account" :
              mode === "verify" ? "Verify and continue" :
              mode === "forgot" ? "Send reset code" :
              "Update password"
            )}
          </Button>
        </form>

        {(mode === "verify" || mode === "reset") && (
          <button type="button" onClick={resend} className="w-full text-center text-sm text-muted-foreground hover:text-foreground mt-4 cursor-pointer">
            Resend code
          </button>
        )}

        {/* Google sign-in — disabled while Google OAuth verification is pending.
        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-foreground/10" /> or <span className="h-px flex-1 bg-foreground/10" />
        </div>
        <Button type="button" onClick={onGoogle} disabled={loading} variant="outline" className="w-full h-12 rounded-full border-foreground/20 hover:bg-foreground/5 cursor-pointer">
          <GoogleIcon className="w-5 h-5" /> Continue with Google
        </Button>
        */}

        <p className="text-sm text-muted-foreground mt-8 text-center">
          {mode === "signup" ? (
            <>Already have an account?{" "}<button type="button" onClick={() => switchMode("signin")} className="text-foreground underline cursor-pointer">Sign in</button></>
          ) : mode === "signin" ? (
            <>New to Sasa?{" "}<button type="button" onClick={() => switchMode("signup")} className="text-foreground underline cursor-pointer">Create an account</button></>
          ) : (
            <button type="button" onClick={() => switchMode("signin")} className="text-foreground underline cursor-pointer">Back to sign in</button>
          )}
        </p>
      </div>
    </main>
  );
}
