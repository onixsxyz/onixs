import { AppHead, LaunchNote } from "@/components/app/AppHead";
import { BoardStats, BoardTable, WatchList } from "@/components/app/Board";
import { charterLive } from "@/config/contracts";
import { BRAND } from "@/config/brand";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/app",
  title: "Markets",
  description: `${BRAND.name} markets: live stock token prices, Chainlink feed ages, Uniswap pool depth and Morpho lending rates for SPY, QQQ and NVDA on Robinhood Chain.`,
  noindex: true,
});

export default function MarketsPage() {
  return (
    <>
      <LaunchNote live={charterLive()} />
      <AppHead title="The board">
        Every listed stock on one screen: what a token is worth, how old its price is, how far the pool sits from the feed, what lenders earn
        and what shorts pay.
      </AppHead>
      <BoardStats />
      <h2 className="mt-10 text-[22px] font-bold">Listed stocks</h2>
      <BoardTable />
      <p className="mt-3 max-w-3xl text-[12.5px] leading-relaxed text-ink-3">
        Token price is the Chainlink answer times the token&apos;s dividend multiplier, the value of one token as held on chain. Feed age turns
        amber past 26 hours, when new positions wait. Pool vs feed compares the 0.05% Uniswap pool with that price.
      </p>
      <h2 className="mt-12 text-[22px] font-bold">Watching, not listed yet</h2>
      <p className="mt-1 text-[14px] text-ink-2">Official Robinhood stock tokens with Chainlink feeds. Listing one needs a deep enough pool first.</p>
      <WatchList />
    </>
  );
}
