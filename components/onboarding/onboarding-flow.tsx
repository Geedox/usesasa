"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { ResumeUpload } from "./resume-upload";
import { OnboardingWizard } from "./wizard";

export function OnboardingFlow({
  hasCv,
  parsed,
  saved,
  savedStep,
}: {
  hasCv: boolean;
  parsed: boolean;
  saved?: Record<string, unknown> | null;
  savedStep?: number;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"upload" | "wizard">(hasCv ? "wizard" : "upload");

  return (
    <div className="min-h-screen bg-foreground/[0.015]">
      <header className="h-14 sticky top-0 z-20 flex items-center justify-between px-6 border-b border-foreground/10 bg-background/80 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-display text-xl">Sasa</span>
          <span className="font-mono text-[10px] text-muted-foreground mt-0.5">beta</span>
        </Link>
        <button
          onClick={async () => {
            await authClient.signOut();
            router.push("/login");
            router.refresh();
          }}
          className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
        >
          Sign out
        </button>
      </header>

      {phase === "upload" ? (
        <ResumeUpload onUploaded={() => setPhase("wizard")} />
      ) : (
        <OnboardingWizard initialParsed={parsed} saved={saved as never} initialStep={savedStep} />
      )}
    </div>
  );
}
