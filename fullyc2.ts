import { config } from "dotenv"; config({ path: ".env.local" });
(async () => {
  const { probeYc } = await import("./lib/ats/yc-probe");
  const { db } = await import("./lib/db");
  const { companies } = await import("./lib/db/schema");
  const t = Date.now();
  const hits = await probeYc("/tmp/yc.json", { concurrency: 8 });
  const seen = new Set<string>();
  const rows = hits.filter(h=>{const k=`${h.ats}:${h.slug}`;if(seen.has(k))return false;seen.add(k);return true;}).map(h=>({name:h.name.slice(0,120),ats:h.ats as any,atsSlug:h.slug}));
  for (let i=0;i<rows.length;i+=200) await db.insert(companies).values(rows.slice(i,i+200)).onConflictDoNothing({ target:[companies.ats,companies.atsSlug] });
  const byAts:Record<string,number>={}; for(const h of hits) byAts[h.ats]=(byAts[h.ats]||0)+1;
  console.log(`\n=== FULL YC PROBE v2 (${((Date.now()-t)/1000).toFixed(0)}s) ===`);
  console.log("hits:",hits.length,"| unique:",rows.length,"| by ats:",JSON.stringify(byAts),"| jobs:",hits.reduce((s,h)=>s+h.jobs,0));
  process.exit(0);
})();
