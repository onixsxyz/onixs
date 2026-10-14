"use client";

import { useBoard } from "@/components/BoardProvider";
import { useNow, usd } from "@/components/ui/Live";
import { ALL_STOCKS } from "@/config/stocks";
import { ageLabel, feedSession } from "@/lib/session";

/**
 * While the feeds rest, the pools keep trading. This board puts the last Chainlink answer next to the
 * pool's price now: the gap is the move that will reach the feed when it wakes up.
 */
export function AfterHours() {
  const { board } = useBoard();
  const now = useNow(20_000);
  const s = feedSession(now);
  const next = new Date(s.nextChange);
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="slab p-5">
          <span className="tag">Feed window</span>
          <b className={`mt-2 block font-display text-[24px] font-black ${s.open ? "text-jade" : "text-amber"}`} style={{ fontStretch: "110%" }} suppressHydrationWarning>
            {s.open ? "Updating" : "Resting"}
          </b>
          <span className="mt-1 block text-[13px] text-ink-3" suppressHydrationWarning>
            {s.open ? "Rests" : "Wakes"} around {next.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })} your time
          </span>
        </div>
        <div className="slab p-5">
          <span className="tag">New positions</span>
          <b className="mt-2 block font-display text-[24px] font-black" style={{ fontStretch: "110%" }}>
            Feed under 26 h
          </b>
          <span className="mt-1 block text-[13px] text-ink-3">Shorts, longs and pairs check the feed&apos;s age on chain.</span>
        </div>
        <div className="slab p-5">
          <span className="tag">Closing</span>
          <b className="mt-2 block font-display text-[24px] font-black text-jade" style={{ fontStretch: "110%" }}>
            Always
          </b>
          <span className="mt-1 block text-[13px] text-ink-3">A close needs the pool, never the feed.</span>
        </div>
      </div>
      <div className="scroll-x mt-6 rounded-[14px] border border-line">
        <table className="w-full min-w-[720px] text-[14px]" data-testid="after-table">
          <thead className="bg-night-2 text-left text-[12.5px] text-ink-3">
            <tr>
              <th className="px-4 py-3 font-semibold">Stock</th>
              <th className="px-3 py-3 text-right font-semibold">Last feed price</th>
              <th className="px-3 py-3 text-right font-semibold">Feed updated</th>
              <th className="px-3 py-3 text-right font-semibold">Pool now</th>
              <th className="px-4 py-3 text-right font-semibold">Gap the feed will catch</th>
            </tr>
          </thead>
          <tbody>
            {ALL_STOCKS.map((st) => {
              const r = board?.rows.find((x) => x.symbol === st.symbol);
              const age = r?.feedUpdatedAt ? now / 1000 - r.feedUpdatedAt : null;
              return (
                <tr key={st.symbol} className="border-t border-line bg-slab">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2.5">
                      <img src={st.logo} alt="" width={26} height={26} className="size-[26px] rounded-md" />
                      <b>{st.symbol}</b>
                      {!st.pool ? <span className="text-[12px] text-ink-3">watch</span> : null}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold">{usd(r?.tokenUsd)}</td>
                  <td className={`px-3 py-3 text-right ${age !== null && age > 26 * 3600 ? "text-amber" : "text-ink-2"}`} suppressHydrationWarning>
                    {age === null ? "…" : ageLabel(age)}
                  </td>
                  <td className="px-3 py-3 text-right">{st.pool ? usd(r?.pool?.usd) : <span className="text-ink-3">no pool listed</span>}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {r?.pool?.gapPct === null || r?.pool?.gapPct === undefined ? <span className="text-ink-3">…</span> : <span className={r.pool.gapPct >= 0 ? "text-jade" : "text-rose"}>{`${r.pool.gapPct >= 0 ? "+" : ""}${r.pool.gapPct.toFixed(2)}%`}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 max-w-3xl text-[12.5px] leading-relaxed text-ink-3">
        The pool price is the 0.05% Uniswap pool&apos;s spot price, which anyone can move with a trade; treat a large gap as a hint, not a quote.
        On weekdays the gap is mostly the pool fee and noise.
      </p>
    </>
  );
}
