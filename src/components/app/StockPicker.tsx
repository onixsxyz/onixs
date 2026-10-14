"use client";

import { useBoard, rowOf } from "@/components/BoardProvider";
import { LISTED } from "@/config/stocks";
import { usd } from "@/components/ui/Live";

/** Row of stock cards; the selected one is outlined in amber. `extra` adds leading cards such as USDG. */
export function StockPicker({ value, onChange, extra = [], note }: { value: string; onChange: (s: string) => void; extra?: { symbol: string; name: string; logo: string }[]; note?: (symbol: string) => string | null }) {
  const { board } = useBoard();
  const items = [...extra, ...LISTED.map((s) => ({ symbol: s.symbol, name: s.name, logo: s.logo }))];
  return (
    <div className={`grid grid-cols-2 gap-2.5 ${items.length > 3 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`} role="radiogroup" aria-label="Choose a market">
      {items.map((s) => {
        const r = rowOf(board, s.symbol);
        const on = s.symbol === value;
        const n = note?.(s.symbol) ?? null;
        return (
          <button
            key={s.symbol}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(s.symbol)}
            className={`slab flex min-w-0 items-center gap-3 p-3 text-left transition-colors ${on ? "!border-amber bg-slab-2" : "hover:bg-slab-2"}`}
          >
            <img src={s.logo} alt="" width={36} height={36} className="size-9 shrink-0 rounded-lg" />
            <span className="min-w-0">
              <span className="block text-[15px] font-bold">{s.symbol}</span>
              <span className="block truncate text-[12px] text-ink-3">{s.symbol === "USDG" ? s.name : usd(r?.tokenUsd)}</span>
              {n ? <span className="mt-0.5 block text-[11.5px] font-semibold text-jade">{n}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
