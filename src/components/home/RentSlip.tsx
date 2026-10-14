"use client";

import { useBoard, rowOf } from "@/components/BoardProvider";
import { LISTED } from "@/config/stocks";
import { compactUsd, usd, FeedAge } from "@/components/ui/Live";

/*
 * The hero's cream slip: the three launch stocks as the chain shows them right now. Price per token from
 * Chainlink (with the token's dividend multiplier), the age of that price, and how deep the Uniswap pool
 * is that one-step shorts and longs fill against. Rent figures join once the ONIXS markets exist.
 */
export function RentSlip() {
  const { board } = useBoard();
  const live = board?.live ?? false;
  return (
    <aside className="relative rounded-[18px] bg-cream p-5 text-night shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)] sm:p-6" aria-labelledby="slip-title" data-testid="rent-slip">
      <span className="absolute -top-3 left-6 h-6 w-20 rounded-sm bg-amber/80" aria-hidden="true" />
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="slip-title" className="font-display text-[22px] font-black tracking-tight" style={{ fontStretch: "112%" }}>
          The rent slip
        </h2>
        <span className="text-[12px] font-semibold text-night/60">live from chain</span>
      </div>
      <p className="mt-1 text-[13.5px] text-night/70">Launch stocks, priced by Chainlink, filled on Uniswap.</p>
      <table className="mt-4 w-full text-[14px]">
        <thead>
          <tr className="border-b border-night/15 text-left text-[11.5px] font-semibold tracking-wide text-night/55 uppercase">
            <th className="py-2 font-semibold">Stock</th>
            <th className="py-2 text-right font-semibold">Token</th>
            <th className="hidden py-2 text-right font-semibold sm:table-cell">Priced</th>
            <th className="py-2 text-right font-semibold">{live ? "Rent / yr" : "Pool depth"}</th>
          </tr>
        </thead>
        <tbody>
          {LISTED.map((s) => {
            const r = rowOf(board, s.symbol);
            const depth = r?.pool && r.tokenUsd ? r.pool.stock * r.tokenUsd + r.pool.usdg : null;
            const rent = r?.onixs?.short?.supplyApr;
            return (
              <tr key={s.symbol} className="border-b border-night/10 last:border-0">
                <td className="py-2.5 font-bold">{s.symbol}</td>
                <td className="py-2.5 text-right font-semibold">{usd(r?.tokenUsd)}</td>
                <td className="hidden py-2.5 text-right text-[13px] sm:table-cell [&_span]:!text-night/70">
                  <FeedAge symbol={s.symbol} />
                </td>
                <td className="py-2.5 text-right font-semibold">{live ? (rent === null || rent === undefined ? "…" : `${(rent * 100).toFixed(2)}%`) : compactUsd(depth)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-[12.5px] leading-relaxed text-night/65">
        {live
          ? "Rent is the interest shorts pay on borrowed stock, accrued every second on Morpho and shared by lenders."
          : "Rent starts when the ONIXS markets open: until then this slip shows the price and the liquidity every trade would meet."}
      </p>
    </aside>
  );
}
