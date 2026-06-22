import Link from "next/link";

// Wraps the dashboard / browse content. When the user has no usable credits we blur
// the content and disable interaction, with a clear prompt to top up. Scanning for
// new jobs is also paused server side until they add credits.
export function CreditGate({ blocked, children }: { blocked: boolean; children: React.ReactNode }) {
  if (!blocked) return <>{children}</>;
  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>
      <div className="fixed inset-0 z-50 flex items-start justify-center px-6 pt-32">
        <div className="w-full max-w-md rounded-xl border border-foreground/10 bg-background p-6 text-center">
          <div className="text-base font-semibold mb-2">Add credits to use Sasa</div>
          <p className="text-sm text-muted-foreground mb-5">
            You are out of credits. Top up to browse your matches, tailor your CV, and submit applications.
            Scanning for new jobs is paused until you add credits.
          </p>
          <Link
            href="/dashboard/settings?tab=billing"
            className="inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Add credits
          </Link>
        </div>
      </div>
    </div>
  );
}
