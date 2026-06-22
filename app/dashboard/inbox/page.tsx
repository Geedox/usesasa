import { getSession } from "@/lib/get-session";
import { isGmailActive } from "@/lib/integrations/gmail";
import { InboxView } from "@/components/dashboard/inbox-view";

export default async function InboxPage() {
  const session = await getSession();
  if (!session) return null;

  const connected = await isGmailActive(session.user.id);

  return (
    <>
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 pt-8">
        <h1 className="font-display text-2xl tracking-tight">Inbox</h1>
        <p className="text-sm text-muted-foreground">Verification, interview, assessment and offer emails from your job applications.</p>
      </div>
      <InboxView connected={connected} email={session.user.email} />
    </>
  );
}
