import { AppHead, LaunchNote } from "@/components/app/AppHead";
import { BorrowDesk, LeverDesk } from "@/components/app/BorrowDesk";
import { charterLive } from "@/config/contracts";
import { BRAND } from "@/config/brand";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/app/borrow", title: "Borrow", description: `Borrow USDG against lent stock tokens on ${BRAND.name}, or open a leveraged long on SPY, QQQ or NVDA up to 1.8x, on Robinhood Chain.`, noindex: true });

export default function BorrowPage() {
  return (
    <>
      <LaunchNote live={charterLive()} />
      <AppHead title="Borrow USDG">Use lent stock as collateral for a USDG loan. Posting it does not pull it out of lending: rent keeps accruing on it the whole time. A deep enough drop in the stock lets liquidators repay your loan with it.</AppHead>
      <BorrowDesk />
      <section id="leverage" className="mt-16 scroll-mt-32 border-t border-line pt-4">
        <AppHead as="h2" title="Leverage in one transaction">Margin in USDG plus a loan taken by your berth purchase a bigger stake than the margin could alone. That stake is lent out and posted underneath, so the long collects rent for as long as it lasts. SPY, QQQ and NVDA only, 1.8x at most.</AppHead>
        <LeverDesk />
      </section>
    </>
  );
}
