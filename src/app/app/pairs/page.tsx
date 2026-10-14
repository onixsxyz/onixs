import { AppHead, LaunchNote } from "@/components/app/AppHead";
import { PairDesk } from "@/components/app/PairDesk";
import { charterLive } from "@/config/contracts";
import { BRAND } from "@/config/brand";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/app/pairs", title: "Pair trades", description: `Pair trades on ${BRAND.name}: long one stock token and short another in one transaction on Robinhood Chain, with the long leg lent for rent.`, noindex: true });

export default function PairsPage() {
  return (
    <>
      <LaunchNote live={charterLive()} />
      <AppHead title="Pair trades">Back one stock against another with a single signature: a leveraged long on one, a short of the same dollar size on the other. The bet is the spread. The long side sits in lending underneath, so it collects rent while the short side pays it.</AppHead>
      <PairDesk />
    </>
  );
}
