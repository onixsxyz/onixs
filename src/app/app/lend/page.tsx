import { AppHead, LaunchNote } from "@/components/app/AppHead";
import { LendDesk } from "@/components/app/LendDesk";
import { charterLive } from "@/config/contracts";
import { BRAND } from "@/config/brand";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/app/lend", title: "Lend", description: `Lend SPY, QQQ or NVDA stock tokens on ${BRAND.name} and earn rent from shorts, or lend USDG to stock-backed borrowers on Robinhood Chain.`, noindex: true });

export default function LendPage() {
  return (
    <>
      <LaunchNote live={charterLive()} />
      <AppHead title="Lend">Lend a stock token and collect rent from the shorts that borrow it, or lend USDG to people borrowing against their lent stock. Withdraw whatever is not out on loan.</AppHead>
      <LendDesk />
    </>
  );
}
