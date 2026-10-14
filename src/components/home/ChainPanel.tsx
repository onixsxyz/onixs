"use client";

import { useBoard, rowOf } from "@/components/BoardProvider";
import { BlockPill, compactUsd } from "@/components/ui/Live";
import { RecentActivity } from "@/components/app/RecentActivity";
import { LISTED } from "@/config/stocks";
import { CHARTER, LISTINGS, MORPHO, UNISWAP_V3, charterLive } from "@/config/contracts";
import { explorerAddress, shortAddress } from "@/config/brand";

/** The home page's "on chain" block: what the chain says now, the latest positions and every contract involved. */
export function ChainPanel() {
  const { board } = useBoard();
  const live = charterLive();
  const bars = LISTED.map((s) => {
    const r = rowOf(board, s.symbol);
    const lent = r?.onixs?.short ? r.onixs.short.supply * (r.tokenUsd ?? 0) : null;
    const depth = r?.pool && r.tokenUsd ? r.pool.stock * r.tokenUsd + r.pool.usdg : null;
    return { symbol: s.symbol, value: live ? lent : depth };
  });
  const top = Math.max(1, ...bars.map((b) => b.value ?? 0));
  const contracts: { label: string; address: string | null }[] = [
    { label: "ONIXS Charter (berths and listings)", address: live ? CHARTER : null },
    ...LISTED.map((s) => ({ label: `${s.symbol} leasehold (lent ${s.symbol})`, address: LISTINGS.find((l) => l.symbol === s.symbol)?.leasehold ?? null })),
    { label: "Morpho Blue", address: MORPHO.blue },
    { label: "Morpho adaptive rate model", address: MORPHO.adaptiveIrm },
    { label: "Uniswap v3 factory", address: UNISWAP_V3.factory },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.25fr_1fr]">
      <div className="slab min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <b className="text-[15px]">ONIXS on the chain right now</b>
          <BlockPill />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Stocks listed" value={live ? String(LISTINGS.length) : "3 at launch"} />
          <Stat label="Gas" value={board?.gasGwei !== null && board?.gasGwei !== undefined ? `${board.gasGwei.toFixed(3)} gwei` : "…"} />
          <Stat label="Lent on Morpho today" value={compactUsd(board?.morphoToday?.supplyUsd)} hint="SPY, QQQ, NVDA, every curator" />
          <Stat label="Borrowed today" value={compactUsd(board?.morphoToday?.borrowUsd)} hint={board?.morphoToday ? `${board.morphoToday.markets} markets` : undefined} />
        </div>
        <div className="mt-7">
          <div className="flex h-[150px] items-end gap-3 sm:gap-6" aria-label={live ? "Stock lent through ONIXS, by stock" : "Uniswap pool depth, by stock"}>
            {bars.map((b) => (
              <div key={b.symbol} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <span className="text-[12px] font-semibold text-ink-2">{compactUsd(b.value)}</span>
                <span className="w-full rounded-t-md bg-gradient-to-t from-jade/30 to-jade/85" style={{ height: `${Math.max(6, ((b.value ?? 0) / top) * 110)}px` }} />
                <span className="text-[12.5px] font-bold">{b.symbol}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12.5px] text-ink-3">{live ? "Stock lent through ONIXS, in dollars." : "Depth of each stock's Uniswap pool, in dollars: the room one-step trades have."}</p>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="slab p-5">
          <h3 className="text-[15px] font-bold">Latest positions</h3>
          <RecentActivity limit={4} />
        </div>
        <div className="slab p-5">
          <h3 className="text-[15px] font-bold">Contracts</h3>
          <ul className="mt-2">
            {contracts.map((c) => (
              <li key={c.label} className="kv !py-2 text-[13.5px]">
                <span className="truncate">{c.label}</span>
                {c.address ? (
                  <a className="font-mono text-[12.5px] text-ink hover:text-amber" href={explorerAddress(c.address)} target="_blank" rel="noreferrer">
                    {shortAddress(c.address)}
                  </a>
                ) : (
                  <span className="text-[12.5px] text-ink-3">at launch</span>
                )}
              </li>
            ))}
          </ul>
          <a className="link mt-3 inline-block text-[13.5px]" href="/app/verify">
            Check every market and feed yourself
          </a>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <span className="block font-display text-[22px] leading-tight font-black" style={{ fontStretch: "110%" }}>
        {value}
      </span>
      <span className="mt-1 block text-[12.5px] text-ink-3">{label}</span>
      {hint ? <span className="block text-[11.5px] text-ink-3/80">{hint}</span> : null}
    </div>
  );
}
