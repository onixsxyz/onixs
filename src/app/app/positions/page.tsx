import { AppHead, LaunchNote } from "@/components/app/AppHead";
import { Positions } from "@/components/app/Positions";
import { charterLive } from "@/config/contracts";
import { BRAND } from "@/config/brand";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/app/positions", title: "Positions", description: `Your ${BRAND.name} positions on Robinhood Chain: stock lent, USDG lent and borrowed, shorts and leveraged longs, read from Morpho.`, noindex: true });

export default function PositionsPage() {
  return (
    <>
      <LaunchNote live={charterLive()} />
      <AppHead title="Positions">Everything one wallet holds on ONIXS, read from the chain: what it lent, what it borrowed, and the shorts and longs in its berth.</AppHead>
      <Positions />
    </>
  );
}
