"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddYourOwn() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const submit = async () => {
    setLoading(true);
    setError("");
    setDone("");
    try {
      const res = await fetch("/api/jobs/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Could not add that link.");
      setDone(`Added ${body.company} (${body.postings} roles). Scoring now — refresh in a moment.`);
      setUrl("");
      setTimeout(() => router.refresh(), 8000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError(""); setDone(""); }}
        className="inline-flex items-center gap-2 rounded-full border border-foreground/15 px-4 py-1.5 text-sm hover:border-foreground/40 cursor-pointer"
      >
        <Plus className="w-4 h-4" /> Add your own
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Add a job</DialogTitle>
            <DialogDescription>
              Paste a job link from Greenhouse, Lever, or Ashby. We'll add the company, pull the role,
              and score it for you. The company is then watched for new roles too.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 mt-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://boards.greenhouse.io/acme/jobs/123"
              onKeyDown={(e) => { if (e.key === "Enter" && url.trim()) submit(); }}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            {done && <p className="text-sm text-green-600">{done}</p>}
          </div>

          <div className="flex items-center justify-end gap-3 mt-4">
            <Button variant="outline" className="rounded-lg cursor-pointer" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              onClick={submit}
              disabled={loading || !url.trim()}
              className="rounded-lg bg-foreground text-background hover:bg-foreground/90 cursor-pointer"
            >
              {loading ? "Adding…" : "Add job"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
