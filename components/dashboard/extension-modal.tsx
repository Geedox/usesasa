"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Chrome } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "sasa_extension_modal_dismissed";

// One-time nudge to install the Chrome extension. Suppressed once the user has
// set it up (connected = true) or dismissed it on this browser.
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
            This agentic flow runs with our Chrome extension. Download it so Sasa can submit your approved
            applications automatically from your own browser, and reach a wider variety of jobs across the globe,
            whether local or remote.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={dismiss} className="rounded-lg cursor-pointer">
            Maybe later
          </Button>
          <Button asChild className="rounded-lg bg-foreground text-background hover:bg-foreground/90 cursor-pointer">
            <Link href="/dashboard/settings" onClick={dismiss}>
              Set up the extension
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
