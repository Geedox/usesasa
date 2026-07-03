import { notFound } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "@/lib/admin";

const BASE = "/admin00944452347756348ad";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminSession();
  // Non-admins (and logged-out visitors) get a 404, so the URL stays unguessable.
  if (!admin) notFound();

  return (
    <div className="min-h-screen bg-[#f6f7f8]">
      <header className="border-b border-foreground/10 bg-background">
        <div className="max-w-[1100px] mx-auto px-6 lg:px-10 h-14 flex items-center gap-6">
          <span className="font-display text-lg">Sasa admin</span>
          <nav className="flex items-center gap-4 text-sm">
            <Link href={BASE} className="text-muted-foreground hover:text-foreground">Overview</Link>
            <Link href={`${BASE}/users`} className="text-muted-foreground hover:text-foreground">Users</Link>
            <Link href={`${BASE}/transactions`} className="text-muted-foreground hover:text-foreground">Transactions</Link>
            <Link href={`${BASE}/usage`} className="text-muted-foreground hover:text-foreground">LLM usage</Link>
            <Link href={`${BASE}/applications`} className="text-muted-foreground hover:text-foreground">Mentor applications</Link>
            <Link href={`${BASE}/mentors`} className="text-muted-foreground hover:text-foreground">Mentors</Link>
            <Link href={`${BASE}/bookings`} className="text-muted-foreground hover:text-foreground">Bookings</Link>
          </nav>
          <span className="ml-auto text-xs text-muted-foreground">{admin.user.email}</span>
        </div>
      </header>
      {children}
    </div>
  );
}
