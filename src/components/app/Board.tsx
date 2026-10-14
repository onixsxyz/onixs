"use client";

import Link from "next/link";
import { useBoard } from "@/components/BoardProvider";
import { compactUsd, pct, usd, FeedAge } from "@/components/ui/Live";
import { LISTED, WATCH } from "@/config/stocks";

export function BoardStats() {
  const { board } = useBoard();
  const live = board?.live ?? false;
  const rows = board?.rows.filter((r) => r.listed) ?? [];
  const lent = live ? rows.reduce((s, r) => s + (r.onixs?.short?.supply ?? 0) * (r.tokenUsd ?? 0), 0) : null;
  const borrowed = live ? rows.reduce((s, r) => s + (r.onixs?.short?.borrowed ?? 0) * (r.tokenUsd ?? 0) + (r.onixs?.credit?.borrowed ?? 0), 0) : null;
  const depth = rows.reduce((s, r) => s + (r.pool && r.tokenUsd ? r.pool.stock * r.tokenUsd + r.pool.usdg : 0), 0);
  const cells = [
    { k: "Lent through ONIXS", v: live ? compactUsd(lent) : "Opens at launch", tone: "" },
    { k: "Borrowed through ONIXS", v: live ? compactUsd(borrowed) : "Opens at launch", tone: "" },
    { k: "Pool depth, three stocks", v: compactUsd(board ? depth : null), tone: "text-jade" },
    { k: "Stock lent on Morpho today", v: compactUsd(board?.morphoToday?.supplyUsd), tone: "", sub: "all curators, SPY · QQQ · NVDA" },
  ];
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-[14px] border border-line lg:grid-cols-4" data-testid="board-stats">
      {cells.map((c, i) => (
        <div key={c.k} className={`min-w-0 bg-slab p-4 sm:p-5 ${i % 2 ? "border-l border-line" : ""} ${i >= 2 ? "border-t border-line lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}>
          <span className="block text-[12.5px] text-ink-3">{c.k}</span>
          <b className={`mt-1 block font-display text-[22px] font-black sm:text-[26px] ${c.tone}`} style={{ fontStretch: "110%" }}>
            {c.v}
          </b>
          {c.sub ? <span className="block text-[11.5px] text-ink-3">{c.sub}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function BoardTable() {
  const { board } = useBoard();
  const live = board?.live ?? false;
  return (
    <div className="scroll-x mt-4 rounded-[14px] border border-line">
      <table className="w-full min-w-[920px] text-[14px]" data-testid="board-table">
        <thead className="bg-night-2 text-left text-[12.5px] text-ink-3">
          <tr>
            <th className="px-4 py-3 font-semibold">Market</th>
            <th className="px-3 py-3 text-right font-semibold">Token price</th>
            <th className="px-3 py-3 text-right font-semibold">Feed</th>
            <th className="px-3 py-3 text-right font-semibold">Pool vs feed</th>
            <th className="px-3 py-3 text-right font-semibold">Lenders earn</th>
            <th className="px-3 py-3 text-right font-semibold">Shorts pay</th>
            <th className="px-3 py-3 text-right font-semibold">USDG loans</th>
            <th className="px-3 py-3 text-right font-semibold">Out on loan</th>
            <th className="px-4 py-3 text-right font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {LISTED.map((s) => {
            const r = board?.rows.find((x) => x.symbol === s.symbol);
            const sh = r?.onixs?.short;
            const cr = r?.onixs?.credit;
            return (
              <tr key={s.symbol} className="border-t border-line bg-slab">
                <td className="px-4 py-3.5">
                  <span className="flex items-center gap-3">
                    <img src={s.logo} alt="" width={32} height={32} className="size-8 rounded-lg" />
                    <span>
                      <span className="ticker">{s.symbol}</span>
                      <span className="mt-0.5 block text-[12px] text-ink-3">{s.name}</span>
                    </span>
                  </span>
                </td>
                <td className="px-3 py-3.5 text-right font-semibold">{usd(r?.tokenUsd)}</td>
                <td className="px-3 py-3.5 text-right text-[13px]">
                  <FeedAge symbol={s.symbol} />
                </td>
                <td className={`px-3 py-3.5 text-right ${r?.pool?.gapPct !== null && r?.pool?.gapPct !== undefined && Math.abs(r.pool.gapPct) > 3 ? "text-amber" : "text-ink-2"}`}>
                  {r?.pool?.gapPct === null || r?.pool?.gapPct === undefined ? "…" : `${r.pool.gapPct >= 0 ? "+" : ""}${r.pool.gapPct.toFixed(2)}%`}
                </td>
                <td className="px-3 py-3.5 text-right font-semibold text-jade">{live ? pct(sh?.supplyApr) : <span className="text-ink-3">at launch</span>}</td>
                <td className="px-3 py-3.5 text-right">{live ? pct(sh?.borrowApr) : <span className="text-ink-3">at launch</span>}</td>
                <td className="px-3 py-3.5 text-right">{live ? pct(cr?.borrowApr) : <span className="text-ink-3">62.5% limit</span>}</td>
                <td className="px-3 py-3.5 text-right">{live ? pct(sh?.util, 1) : <span className="text-ink-3">…</span>}</td>
                <td className="px-4 py-3.5">
                  <span className="flex justify-end gap-1.5">
                    <Link href={`/app/lend?m=${s.symbol}`} className="btn btn-sm">
                      Lend
                    </Link>
                    <Link href={`/app/borrow?m=${s.symbol}`} className="btn btn-sm btn-line">
                      Borrow
                    </Link>
                    <Link href={`/app/short?m=${s.symbol}`} className="btn btn-sm btn-line">
                      Short
                    </Link>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function WatchList() {
  const { board } = useBoard();
  return (
    <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-7">
      {WATCH.map((s) => {
        const r = board?.rows.find((x) => x.symbol === s.symbol);
        return (
          <div key={s.symbol} className="slab min-w-0 p-3.5">
            <span className="flex items-center gap-2">
              <img src={s.logo} alt="" width={24} height={24} className="size-6 rounded-md" />
              <b className="text-[14px]">{s.symbol}</b>
            </span>
            <span className="mt-2 block text-[15px] font-semibold">{usd(r?.tokenUsd)}</span>
            <span className="block text-[12px]">
              <FeedAge symbol={s.symbol} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
