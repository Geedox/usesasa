import { ReferralCreditForm } from "@/components/admin/referral-credit-form";

export default function AdminReferralCreditPage() {
  return (
    <main className="max-w-[1100px] mx-auto px-6 lg:px-10 py-8">
      <h1 className="font-display text-2xl mb-1">Referral credit</h1>
      <p className="text-sm text-muted-foreground mb-6">Manually credit a referrer when a referral was missed.</p>
      <ReferralCreditForm />
    </main>
  );
}
