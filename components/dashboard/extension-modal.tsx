"use client";

import { useEffect, useState } from "react";
import { Chrome } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "sasa_extension_modal_dismissed";

// One-time heads-up that the Chrome extension is on the way. The download is not
// live yet, so the primary action is disabled ("Coming soon"). Suppressed once the
// user has it set up (connected = true) or dismissed it on this browser.
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
          <DialogTitle className="font-display text-2xl tracking-tight">The Sasa Chrome extension is coming soon</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            We are putting the finishing touches on the Sasa browser extension. It will let you autofill and queue
            applications on any career page, right from your own browser. In the meantime, Sasa already finds roles
            and submits the applications you approve for you, so you can keep applying today. We will let you know
            the moment it is ready.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={dismiss} className="rounded-lg cursor-pointer">
            Got it
          </Button>
          <Button
            disabled
            aria-disabled="true"
            className="rounded-lg bg-foreground text-background opacity-60 cursor-not-allowed"
          >
            Coming soon
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
