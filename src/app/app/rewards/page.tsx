import Link from "next/link";
import { AppHead } from "@/components/app/AppHead";
import { CaStrip } from "@/components/CopyCa";
import { BRAND } from "@/config/brand";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/app/rewards", title: "Rewards", description: `${BRAND.symbol} rewards for ${BRAND.name} lenders: the plan, who would qualify and what is live today on Robinhood Chain.`, noindex: true });

const PLAN = [
  ["Who earns", "Wallets that lend a stock token through a leasehold, and wallets that lend USDG in an ONIXS credit market. Shorts and borrowers pay; they do not earn rewards."],
  ["How it is counted", "From balances anyone can read on chain: leasehold shares and Morpho supply positions, sampled over time, so a deposit made a minute before a snapshot counts for a minute."],
  ["How it is paid", "Through a claim contract with a published list, so every wallet can check its own line before claiming."],
  ["What is live today", "Nothing. No rewards contract is deployed, no balances are being counted and nothing is owed. When that changes, this page will show the contract and the schedule."],
];

export default function RewardsPage() {
  return (
    <>
      <AppHead title={`${BRAND.symbol} rewards`}>Rent is what lenders earn from day one. {BRAND.symbol} on top is the plan for later: here is how it is meant to work, and exactly what exists now.</AppHead>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="grid grid-cols-1 gap-3">
          {PLAN.map(([t, b], i) => (
            <div key={t} className={`slab p-5 ${i === 3 ? "!border-amber/50" : ""}`}>
              <h2 className="text-[17px] font-semibold">{t}</h2>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{b}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <CaStrip large />
          <div className="slab p-5">
            <h2 className="text-[17px] font-semibold">{BRAND.symbol} promises nothing</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">It trades as a Pons launch. Nobody guarantees it any value or income, and it may end up worthless. The rules page has the full list of risks.</p>
            <Link href="/rules" className="link mt-3 inline-block text-[14px]">Read the rules</Link>
          </div>
        </div>
      </div>
    </>
  );
}
