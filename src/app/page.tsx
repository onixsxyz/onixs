import Link from "next/link";
import { BRAND } from "@/config/brand";
import { RentSlip } from "@/components/home/RentSlip";
import { ChainPanel } from "@/components/home/ChainPanel";
import { DeskFigure } from "@/components/home/DeskFigure";
import { CaStrip } from "@/components/CopyCa";
import { SessionPill } from "@/components/ui/Live";
import { RuleIcon } from "@/components/RuleIcon";
import { RULES } from "@/content/rules";
import { FAQ } from "@/content/faq";
import { HOME_DESCRIPTION, HOME_TITLE, appLd, ldJson, pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/", title: HOME_TITLE, description: HOME_DESCRIPTION });

const DESKS = [
  {
    href: "/app/lend",
    title: "Lend a stock token, collect rent",
    body: "Deposit SPY, QQQ or NVDA into its leasehold. Every token goes into one Morpho market where shorts borrow it, and the interest they pay accrues to lenders by the second. Withdraw whenever the stock is not out on loan.",
    fig: "lend",
  },
  {
    href: "/app/lend#usdg",
    title: "Lend USDG to people borrowing against stock",
    body: "Supply USDG to the market where stock lenders borrow dollars against their leasehold shares. You earn what those borrowers pay, and their collateral is stock still collecting rent of its own.",
    fig: "usdg",
  },
  {
    href: "/app/borrow",
    title: "Borrow USDG without selling the stock",
    body: "Post leasehold shares and take USDG against them, up to 62.5% of their value. The stock beneath never leaves lending, so rent keeps landing on the collateral while you spend the dollars.",
    fig: "borrow",
  },
  {
    href: "/app/short",
    title: "Short a stock in a single transaction",
    body: "Put up USDG margin; your berth borrows the stock, sells it on its Uniswap pool and keeps the proceeds as collateral. Closing buys the stock back and returns whatever USDG is left. Shorts pay the rent lenders earn.",
    fig: "short",
  },
  {
    href: "/app/borrow#leverage",
    title: "Lean into SPY, QQQ or NVDA at up to 1.8x",
    body: "Your USDG plus a USDG loan in your berth's name buys more of the stock in one go. The stock is lent and posted, so the long collects rent until you close it, and closing unwinds every step in one transaction.",
    fig: "lever",
  },
  {
    href: "/app/pairs",
    title: "Pair trades: long one, short another",
    body: "Back NVDA against the index, or QQQ against SPY, with both legs opened by one signature. The long leg is lent out underneath, so rent earned on one side offsets part of the rent paid on the other.",
    fig: "pair",
  },
  {
    href: "/app/rewards",
    title: "$ONIXS for lenders, later",
    body: "The plan is to share $ONIXS among stock and USDG lenders on top of rent, counted from on-chain balances. Nothing is distributed until that contract exists, and nothing about its value is promised.",
    fig: "coin",
  },
] as const;

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(appLd)} />
      <section className="wrap grid grid-cols-1 items-center gap-12 pt-12 pb-20 lg:grid-cols-[1.15fr_1fr] lg:pt-20">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SessionPill />
            <span className="chip">on Robinhood Chain</span>
          </div>
          <h1 className="mt-3 font-display text-[40px] leading-[0.98] font-black tracking-[-0.02em] sm:text-[58px] lg:text-[66px]" style={{ fontStretch: "125%" }}>
            <span className="block">Lend stocks.</span>
            <span className="block">Earn rent.</span>
            <span className="block text-ink-2">Short at your own risk.</span>
          </h1>
          <p className="mt-5 text-[16px] font-semibold tracking-wide text-amber">{BRAND.name}: stock token lending, borrowing and shorting on Robinhood Chain</p>
          <p className="mt-3 max-w-xl text-[18px] leading-relaxed text-ink-2">{BRAND.tagline}</p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link href="/app" className="btn h-[50px] px-6 text-[16px]">
              Open the app
            </Link>
            <Link href="/app/lend" className="text-[15px] font-semibold text-ink underline decoration-amber decoration-2 underline-offset-[6px]">
              Lend a stock token
            </Link>
          </div>
          <div className="mt-8 max-w-[520px]">
            <CaStrip />
          </div>
        </div>
        <RentSlip />
      </section>

      <section id="desks" className="wrap scroll-mt-28" aria-labelledby="desks-title">
        <div className="grid grid-cols-1 gap-6 border-b border-line pb-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <span className="band" />
            <h2 id="desks-title" className="mt-4 text-[32px] font-bold tracking-tight sm:text-[38px]">
              Seven things a stock token can do on ONIXS
            </h2>
          </div>
          <p className="max-w-sm text-[15px] text-ink-2">From your own wallet, on Morpho markets that ONIXS lists and cannot take over.</p>
        </div>
        <ol>
          {DESKS.map((d, i) => (
            <li key={d.title} className="grid grid-cols-1 gap-4 border-b border-line py-7 md:grid-cols-[220px_1fr] md:gap-10">
              <DeskFigure kind={d.fig} />
              <div className="min-w-0">
                <span className="text-[12.5px] font-semibold text-ink-3">0{i + 1}</span>
                <h3 className="mt-1 text-[21px] font-semibold">
                  <Link href={d.href} className="hover:text-amber">
                    {d.title}
                  </Link>
                </h3>
                <p className="mt-2 max-w-2xl text-[15.5px] leading-relaxed text-ink-2">{d.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap mt-24" aria-labelledby="rent-title">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <span className="band" />
            <h2 id="rent-title" className="mt-4 text-[32px] font-bold tracking-tight sm:text-[38px]">
              Where the rent comes from
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-ink-2">
              Shorting needs shares to sell. On ONIXS those shares come from lenders, and the price of borrowing them is rent: an interest
              rate set by how much of the stock is already out.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ["Supply meets demand", "Every listed stock has one Morpho market where it is the asset lent and USDG is the collateral. Lenders supply through the stock's leasehold; shorts borrow from the same market."],
              ["The rate floats", "Morpho's adaptive model aims for 90% of the stock to be out on loan. Below that the rate drifts down, above it the rate climbs fast. No one at ONIXS sets it."],
              ["Interest lands on lenders", "What shorts owe grows every second. That growth is the leasehold's balance growing, so each lender's share is worth more stock over time. Nothing has to be claimed."],
              ["Posted stock keeps earning", "Leasehold shares can be posted as collateral for USDG, or bought by a leveraged long. Either way the stock underneath stays lent and keeps collecting rent."],
            ].map(([t, b]) => (
              <div key={t} className="slab p-5">
                <h3 className="text-[16px] font-semibold">{t}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="chain" className="wrap mt-24 scroll-mt-28" aria-labelledby="chain-title">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <span className="band" />
            <h2 id="chain-title" className="mt-4 text-[32px] font-bold tracking-tight sm:text-[38px]">
              Every number is read from Robinhood Chain
            </h2>
          </div>
          <p className="max-w-sm text-[15px] text-ink-2">Feeds, pools and Morpho markets, refreshed while you watch.</p>
        </div>
        <ChainPanel />
      </section>

      <section id="rules" className="wrap mt-24 scroll-mt-28" aria-labelledby="rules-title">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[340px_1fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <span className="band" />
            <h2 id="rules-title" className="mt-4 text-[32px] font-bold tracking-tight sm:text-[38px]">
              The rules, before any money moves
            </h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-ink-2">Each line is the short version. Open it for the whole rule, or read them all on one page.</p>
            <Link href="/rules" className="link mt-4 inline-block text-[14.5px]">
              All rules on one page
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-2.5">
            {RULES.map((r) => (
              <details key={r.title} className="slab group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center gap-3 text-[15px] font-semibold">
                  <span className="text-amber">
                    <RuleIcon name={r.icon} />
                  </span>
                  <span className="min-w-0 flex-1">{r.title}</span>
                  <span className="text-ink-3 transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-3 pl-8 text-[14.5px] leading-relaxed text-ink-2">{r.body}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap mt-24" aria-labelledby="faq-title">
        <span className="band" />
        <h2 id="faq-title" className="mt-4 text-[32px] font-bold tracking-tight sm:text-[38px]">
          Short answers about ONIXS
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2">
          {FAQ.slice(0, 6).map((f) => (
            <div key={f.q} className="min-w-0">
              <h3 className="text-[17px] font-semibold">{f.q}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{f.a}</p>
            </div>
          ))}
        </div>
        <Link href="/docs" className="link mt-8 inline-block text-[15px]">
          Read the docs
        </Link>
      </section>
    </>
  );
}
