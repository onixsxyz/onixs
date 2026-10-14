import Link from "next/link";
import { FAQ } from "@/content/faq";
import { BRAND, CHAIN, USDG } from "@/config/brand";
import { MORPHO, UNISWAP_V3 } from "@/config/contracts";
import { LISTED, LISTING_PARAMS } from "@/config/stocks";
import { breadcrumbLd, faqLd, ldJson, pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/docs", title: "Docs", description: `How ${BRAND.name} works: leaseholds, Morpho markets, berths, rent, shorting, leverage and pair trades for stock tokens on Robinhood Chain.` });

const SECTIONS = [
  { id: "pieces", title: "The pieces" },
  { id: "rent", title: "How rent is set and paid" },
  { id: "short", title: "What a short does, step by step" },
  { id: "long", title: "What a leveraged long does" },
  { id: "weekend", title: "Feeds, weekends and stale prices" },
  { id: "limits", title: "Limits per stock" },
  { id: "network", title: "Adding Robinhood Chain to a wallet" },
  { id: "faq", title: "Questions" },
];

export default function DocsPage() {
  return (
    <div className="wrap grid grid-cols-1 gap-10 pt-14 lg:grid-cols-[220px_1fr]">
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson([faqLd(FAQ), breadcrumbLd([{ name: "Docs", path: "/docs" }])])} />
      <nav aria-label="On this page" className="hidden lg:sticky lg:top-28 lg:block lg:self-start">
        <span className="tag">On this page</span>
        <ul className="mt-3 space-y-2 text-[14px]">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-ink-2 hover:text-ink">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <article className="prose-onixs min-w-0 max-w-3xl">
        <span className="band" />
        <h1 className="mt-4 font-display text-[38px] leading-tight font-black sm:text-[46px]" style={{ fontStretch: "118%" }}>
          How {BRAND.name} works
        </h1>
        <p>
          {BRAND.name} is a stock token lending protocol on {CHAIN.name}. It lists tokenized shares that Robinhood issues on the chain, opens
          Morpho markets for them, and gives every wallet a small contract of its own to run shorts, leveraged longs and pair trades in one
          transaction. Nothing below needs trust in a team: each piece is a contract you can read, and the Verify tab checks them live.
        </p>

        <h2 id="pieces" className="scroll-mt-28">The pieces</h2>
        <ul>
          <li><b>Leasehold</b>: one per stock. An ERC-4626 vault with no owner and no fee. It takes the stock you lend and supplies all of it to the stock&apos;s short market on Morpho. Your shares grow in stock as rent accrues.</li>
          <li><b>Short market</b>: a Morpho market where the stock is lent and USDG is the collateral. Shorts borrow here; leaseholds supply here.</li>
          <li><b>Credit market</b>: a Morpho market where USDG is lent and leasehold shares are the collateral. Stock lenders borrow dollars here without selling; USDG lenders supply here.</li>
          <li><b>Price marks</b>: two small oracles per stock, one per market, that read the stock&apos;s Chainlink feed, apply the token&apos;s dividend multiplier and price USDG at its own feed, never above one dollar.</li>
          <li><b>Charter</b>: the registry. It holds each listing (stock, feed, pool, leasehold, both markets and their limits), opens berths, and is the single address every berth reports activity to. Its owner is set once at deployment and can never be transferred or replaced; that owner can only list a stock or pause new positions on a listing.</li>
          <li><b>Berth</b>: your own account contract, created on your first trade. Only your wallet can operate it. It holds your shorts and leveraged longs on Morpho in its own name, so you never give a shared contract power over your other Morpho positions.</li>
        </ul>

        <h2 id="rent" className="scroll-mt-28">How rent is set and paid</h2>
        <p>
          Rent is the interest a short pays on the stock it borrowed. {BRAND.name} does not set it. Each short market uses Morpho&apos;s adaptive
          curve rate model at <code className="font-mono text-[13px]">{MORPHO.adaptiveIrm}</code>, which targets 90% of the supply being borrowed:
          above that the rate climbs steeply, below it the rate eases down over time. Interest is added to what shorts owe every time the market
          is touched and compounds continuously in between.
        </p>
        <p>
          A lender&apos;s share of the leasehold is a share of the leasehold&apos;s supply position on Morpho. When shorts owe more stock, that
          supply position is worth more stock, and so is every share. Nothing is claimed and nothing is sent at a set hour; the balance simply
          reads higher each day. That is what the tagline means by rent paid daily.
        </p>
        <p>Morpho&apos;s owner can switch on a protocol fee of up to 25% of a market&apos;s interest; new markets start at zero and the board reads the fee from Morpho, so a change shows up there. {BRAND.name} takes no fee.</p>

        <h2 id="short" className="scroll-mt-28">What a short does, step by step</h2>
        <p>Opening a short is one call to your berth with your USDG margin, the amount of stock to borrow and the least USDG the sale must bring.</p>
        <ul>
          <li>The berth takes your margin and posts it, together with the expected sale proceeds, as collateral in the short market.</li>
          <li>Inside the same transaction it borrows the stock from the market and sells it on the stock&apos;s 0.05% Uniswap v3 pool.</li>
          <li>It refuses the fill if the pool sits more than 3% from the Chainlink price, if the feed is older than 26 hours, or if the sale brings less than your minimum.</li>
          <li>It checks the opening use against the listing&apos;s limit (65% on SPY and QQQ, 50% on NVDA), well below the liquidation line.</li>
        </ul>
        <p>
          Closing repays the whole debt, takes the USDG back, buys exactly the stock owed on the pool and sends you the rest. It never needs the
          feed, so it works on weekends. If the stock rose, the buy-back costs more and you get back less.
        </p>

        <h2 id="long" className="scroll-mt-28">What a leveraged long does</h2>
        <p>
          Your margin plus a USDG loan buys the stock on its pool. The berth lends that stock into the leasehold, posts the shares in the credit
          market and borrows the loan against them, all inside one Morpho flash loan that is repaid before the transaction ends. The stock you
          hold is lent the whole time, so it earns rent while the loan costs interest. The most is 1.8 times the margin, on SPY, QQQ and NVDA.
        </p>

        <h2 id="weekend" className="scroll-mt-28">Feeds, weekends and stale prices</h2>
        <p>
          Chainlink publishes Robinhood stock prices on a 24/5 schedule: continuously from Sunday 8pm to Friday 8pm New York time, with a 0.5%
          deviation trigger and a 24 hour heartbeat. Over the weekend the last answer stands. Morpho keeps using it for health checks, so
          liquidations and borrowing keep working on Friday&apos;s price, and whatever happened in the world arrives in one step on Sunday
          night. That is the main gap risk lenders are paid to carry.
        </p>
        <p>{BRAND.name} adds one rule on top: new shorts, longs and pairs need a feed answer younger than 26 hours. Closing, repaying, lending and withdrawing are never blocked by feed age.</p>

        <h2 id="limits" className="scroll-mt-28">Limits per stock</h2>
        <div className="scroll-x mt-4 rounded-xl border border-line">
          <table className="w-full min-w-[560px] text-[14px]">
            <thead className="bg-night-2 text-left text-[12.5px] text-ink-3">
              <tr>
                <th className="px-3 py-2.5">Stock</th>
                <th className="px-3 py-2.5 text-right">Short liquidation</th>
                <th className="px-3 py-2.5 text-right">Short opening</th>
                <th className="px-3 py-2.5 text-right">USDG loan limit</th>
                <th className="px-3 py-2.5 text-right">Leverage</th>
              </tr>
            </thead>
            <tbody>
              {LISTED.map((s) => {
                const p = LISTING_PARAMS[s.symbol];
                return (
                  <tr key={s.symbol} className="border-t border-line">
                    <td className="px-3 py-2.5 font-semibold">{s.symbol}</td>
                    <td className="px-3 py-2.5 text-right">{(p.shortLltv * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2.5 text-right">{(p.shortOpenLtv * 100).toFixed(0)}%</td>
                    <td className="px-3 py-2.5 text-right">{(p.creditLltv * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2.5 text-right">up to {p.maxLeverage}x</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p>These are the settings each listing is created with. A listing cannot be edited afterwards; a change would mean a new listing with new markets.</p>

        <h2 id="network" className="scroll-mt-28">Adding Robinhood Chain to a wallet</h2>
        <ul>
          <li>Network name: {CHAIN.name}</li>
          <li>Chain id: {CHAIN.id} ({CHAIN.hex})</li>
          <li>RPC: {CHAIN.publicRpc}</li>
          <li>Currency: ETH · Explorer: {CHAIN.explorer}</li>
          <li>USDG: <code className="font-mono text-[13px]">{USDG.address}</code> (6 decimals). Uniswap quotes come from <code className="font-mono text-[13px]">{UNISWAP_V3.quoterV2}</code>.</li>
        </ul>
        <p>The connect dialog adds the network for you when the wallet does not have it.</p>

        <h2 id="faq" className="scroll-mt-28">Questions</h2>
        {FAQ.map((f) => (
          <div key={f.q} className="mt-6">
            <h3 className="text-[18px] font-semibold text-ink">{f.q}</h3>
            <p className="!mt-2">{f.a}</p>
          </div>
        ))}
        <p className="!mt-10">
          Ready? <Link href="/app" className="link">Open the board</Link> or read the <Link href="/rules" className="link">rules</Link> first.
        </p>
      </article>
    </div>
  );
}
