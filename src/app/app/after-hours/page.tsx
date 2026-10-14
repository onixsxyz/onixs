import { AppHead, LaunchNote } from "@/components/app/AppHead";
import { AfterHours } from "@/components/app/AfterHours";
import { charterLive } from "@/config/contracts";
import { BRAND } from "@/config/brand";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/app/after-hours", title: "After hours", description: `${BRAND.name} after hours: the last Chainlink stock price next to the live Uniswap pool price, and how weekends affect new positions.`, noindex: true });

export default function AfterHoursPage() {
  return (
    <>
      <LaunchNote live={charterLive()} />
      <AppHead title="After hours">Stock feeds update from Sunday evening to Friday evening, New York time. The pools never close. Here is how far each stock&apos;s pool has drifted from its last feed answer, and what that means for positions.</AppHead>
      <AfterHours />
    </>
  );
}
