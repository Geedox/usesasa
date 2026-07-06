"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Chrome } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Bumped to _v2 so users who dismissed the earlier "Coming soon" version see this
// updated "Add to Chrome" modal once (the extension is now live on the Web Store).
const DISMISS_KEY = "sasa_extension_modal_dismissed_v2";
const EXTENSION_URL =
  process.env.NEXT_PUBLIC_EXTENSION_URL ||
  "https://chromewebstore.google.com/detail/sasa/pcpbinadolndiebjjoidnjbnmkfjllif";

// One-time nudge to install the Sasa Chrome extension (now live on the Web Store).
// Suppressed once the user has it set up (connected = true) or dismissed it here.
export function ExtensionModal({ connected }: { connected: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (connected) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    setOpen(true);
  }, [connected]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/[0.06]">
            <Chrome className="h-5 w-5" />
          </div>
          <DialogTitle className="font-display text-2xl tracking-tight">Add the Sasa Chrome extension</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Get the Sasa browser extension to autofill and queue applications on any career page, right from your own
            browser. It shows your match score, tailors your CV to the role, and fills the form so you just review and
            submit. It is free and installs in a couple of clicks.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={dismiss} className="rounded-lg cursor-pointer">
            Maybe later
          </Button>
          <Button asChild className="rounded-lg bg-foreground text-background hover:bg-foreground/90 cursor-pointer">
            <Link href={EXTENSION_URL} target="_blank" rel="noreferrer" onClick={dismiss}>
              Add to Chrome
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
