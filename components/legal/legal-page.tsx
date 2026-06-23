import Link from "next/link";

export type LegalBlock = { p?: string; sub?: string; list?: string[] };
export type LegalSection = { title: string; blocks: LegalBlock[] };

// Shared layout for the Privacy Policy and Terms pages. Content lives in plain JS
// strings (passed as data) so quotes/apostrophes don't trip JSX entity linting.
export function LegalPage({
  title,
  effectiveDate,
  intro,
  sections,
}: {
  title: string;
  effectiveDate: string;
  intro: string[];
  sections: LegalSection[];
}) {
  return (
    <main className="min-h-screen bg-background text-foreground noise-overlay">
      <div className="max-w-3xl mx-auto px-6 py-16 lg:py-24">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          {"← Back to home"}
        </Link>

        <h1 className="font-display text-4xl lg:text-5xl tracking-tight mt-8 mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground mb-10">Effective date: {effectiveDate}</p>

        {intro.map((p, i) => (
          <p key={`intro-${i}`} className="text-muted-foreground leading-relaxed mb-4">{p}</p>
        ))}

        {sections.map((s, i) => (
          <section key={`s-${i}`} className="mt-10">
            <h2 className="font-display text-xl lg:text-2xl tracking-tight mb-3">{s.title}</h2>
            {s.blocks.map((b, j) => {
              if (b.sub) return <h3 key={j} className="font-medium text-foreground mt-5 mb-1.5">{b.sub}</h3>;
              if (b.list)
                return (
                  <ul key={j} className="list-disc pl-5 space-y-1.5 text-muted-foreground leading-relaxed mb-3">
                    {b.list.map((li, k) => <li key={k}>{li}</li>)}
                  </ul>
                );
              return <p key={j} className="text-muted-foreground leading-relaxed mb-3">{b.p}</p>;
            })}
          </section>
        ))}
      </div>
    </main>
  );
}
