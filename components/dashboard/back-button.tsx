"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Navigates to the previous page in history.
export function BackButton({ label = "Back" }: { label?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
    >
      <ArrowLeft className="h-4 w-4" /> {label}
    </button>
  );
}
