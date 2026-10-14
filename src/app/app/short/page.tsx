import { AppHead, LaunchNote } from "@/components/app/AppHead";
import { ShortDesk } from "@/components/app/ShortDesk";
import { charterLive } from "@/config/contracts";
import { BRAND } from "@/config/brand";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/app/short", title: "Short", description: `Short SPY, QQQ or NVDA stock tokens in one transaction on ${BRAND.name}: borrow from lenders, sell on Uniswap, hold USDG on Morpho.`, noindex: true });

export default function ShortPage() {
  return (
    <>
      <LaunchNote live={charterLive()} />
      <AppHead title="Short">Borrow a stock from its lenders and sell it within one transaction. A falling price makes the later buy-back cheaper and you keep the spread; a rising price makes it dearer and you pay it. Every open short pays rent to the lenders.</AppHead>
      <ShortDesk />
    </>
  );
}
