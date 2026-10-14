"use client";

import { charterLive } from "@/config/contracts";
import { useCharterEvents } from "@/lib/onixs/events";
import { explorerTx } from "@/config/brand";

/** Latest berth activity, read from the Charter's events (one address for the whole protocol). */
export function RecentActivity({ limit = 6 }: { limit?: number }) {
  const { events, loading } = useCharterEvents();
  if (!charterLive()) return <p className="mt-3 text-[13.5px] text-ink-3">No positions yet: shorts, longs and pairs open when the ONIXS contracts go live.</p>;
  if (loading && !events.length) return <p className="mt-3 text-[13.5px] text-ink-3">Reading the chain…</p>;
  if (!events.length) return <p className="mt-3 text-[13.5px] text-ink-3">Nothing opened or closed in the most recent blocks.</p>;
  return (
    <ol className="mt-2">
      {events.slice(0, limit).map((e) => (
        <li key={e.tx + e.kind} className="kv !py-2 text-[13.5px]">
          <span className="flex min-w-0 items-center gap-2">
            <span className="ticker" data-tone={e.kind.includes("Short") ? undefined : "jade"}>{e.symbol}</span>
            <span className="truncate">{e.label}</span>
          </span>
          <a href={explorerTx(e.tx)} target="_blank" rel="noreferrer" className="text-ink-2 hover:text-amber">
            block {e.block.toLocaleString("en-US")}
          </a>
        </li>
      ))}
    </ol>
  );
}
