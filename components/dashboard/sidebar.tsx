"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { FeedbackButton } from "@/components/dashboard/feedback-button";
import {
  LayoutGrid,
  Search,
  KanbanSquare,
  CalendarClock,
  GraduationCap,
  User,
  Settings,
  MessageCircle,
  Chrome,
  Send,
  LogOut,
} from "lucide-react";

const nav = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { name: "Browse jobs", href: "/dashboard/browse", icon: Search },
  // Inbox is hidden until Google approves the Gmail scope. Re-enable when cleared.
  // { name: "Inbox", href: "/dashboard/inbox", icon: Inbox },
  { name: "Tracker", href: "/dashboard/tracker", icon: KanbanSquare },
  { name: "Interview prep", href: "/dashboard/interview-prep", icon: CalendarClock },
  { name: "Profile", href: "/dashboard/profile", icon: User },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

const channels = [
  { name: "WhatsApp", icon: MessageCircle },
  { name: "Chrome", icon: Chrome },
  { name: "Telegram", icon: Send },
];

export function DashboardSidebar({
  name,
  email,
  credits,
  isMentor = false,
}: {
  name: string;
  email: string;
  credits: number;
  isMentor?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  // Insert the Mentor link after Interview prep (index 3 now that Inbox is hidden).
  const navItems = isMentor
    ? [...nav.slice(0, 4), { name: "Mentor", href: "/dashboard/mentor", icon: GraduationCap }, ...nav.slice(4)]
    : nav;

  return (
    <aside className="w-64 shrink-0 border-r border-foreground/10 bg-background flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="px-5 h-16 flex items-center gap-2">
        <span className="font-display text-xl">Sasa</span>
        <span className="font-mono text-[10px] text-muted-foreground mt-1">
          beta
        </span>
      </div>

      {/* Nav */}
      <nav className="px-3 mt-2 flex flex-col gap-0.5">
        {navItems.map((item) => {
          const active = item.href === pathname;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-foreground/[0.06] text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.03]"
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span className="flex-1">{item.name}</span>
            </Link>
          );
        })}
        <FeedbackButton />
      </nav>

      <div className="flex-1" />

      {/* Channels */}
      <div className="px-5 mb-4">
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
          Channels
        </p>
        <div className="grid grid-cols-3 gap-2">
          {channels.map((c) => (
            <div
              key={c.name}
              title={c.name}
              className="flex flex-col items-center gap-1 rounded-lg border border-foreground/10 py-3 text-muted-foreground"
            >
              <c.icon className="w-4 h-4" />
              <span className="text-[10px] leading-tight text-center">
                {c.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* User / credits */}
      <div className="m-3 rounded-xl bg-foreground text-background p-4">
        <div className="text-sm font-medium truncate">
          {name || "Your account"}
        </div>
        <div className="text-xs text-background/60 truncate mb-3">{email}</div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-background/70">Credits</span>
          <span className="font-display text-2xl">{credits}</span>
        </div>
        <div className="text-[11px] text-background/50 mb-3">Tailor 1 · Submit 1 · Interview 24</div>
        <Link href="/dashboard/settings?tab=billing" className="block w-full text-center rounded-lg bg-background text-foreground text-sm py-2 cursor-pointer hover:bg-background/90">
          Buy more credits
        </Link>
        <button
          onClick={async () => {
            setSigningOut(true);
            await authClient.signOut();
            router.push("/login");
            router.refresh();
          }}
          className="w-full mt-2 flex items-center justify-center gap-2 text-xs text-background/70 hover:text-background py-1.5 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
