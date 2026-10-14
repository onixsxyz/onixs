import { AppHead } from "@/components/app/AppHead";
import { explorerAddress, shortAddress } from "@/config/brand";
import { BRAND } from "@/config/brand";
import { runChecks } from "@/lib/server/verify";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMeta({ path: "/app/verify", title: "Verify", description: `Check ${BRAND.name} on chain: stock token identity, Chainlink feeds, Uniswap pools, Morpho settings and the ONIXS contracts on Robinhood Chain.`, noindex: true });

export default async function VerifyPage() {
  const checks = await runChecks().catch(() => []);
  const groups = [...new Set(checks.map((c) => c.group))];
  return (
    <>
      <AppHead title="Verify on chain">
        Every address this site touches, checked against Robinhood Chain when you load the page. Tickers prove nothing on this chain, so a stock
        token passes only if its code embeds Robinhood&apos;s beacon and its name and symbol match.
      </AppHead>
      {!checks.length ? <p className="slab p-5 text-ink-2">The chain could not be read just now. Reload in a moment.</p> : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {groups.map((g) => (
          <section key={g} className="slab min-w-0 p-5" aria-labelledby={`g-${g}`}>
            <h2 id={`g-${g}`} className="text-[18px] font-bold">{g}</h2>
            <ul className="mt-2" data-testid="verify-list">
              {checks.filter((c) => c.group === g).map((c, i) => (
                <li key={c.label + i} className="flex items-start gap-3 border-b border-line py-3 last:border-0">
                  <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${c.ok === true ? "bg-jade text-night" : c.ok === false ? "bg-rose text-night" : "bg-slab-3 text-ink-3"}`} aria-label={c.ok === true ? "passed" : c.ok === false ? "failed" : "not checked"}>
                    {c.ok === true ? "✓" : c.ok === false ? "!" : "·"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold">{c.label}</span>
                    <span className="block text-[12.5px] break-words text-ink-3">{c.detail}</span>
                  </span>
                  {c.address ? (
                    <a href={explorerAddress(c.address)} target="_blank" rel="noreferrer" className="shrink-0 font-mono text-[12.5px] text-ink-2 hover:text-amber">
                      {shortAddress(c.address)}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
