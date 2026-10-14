"use client";

import { useBoard, rowOf } from "@/components/BoardProvider";
import { compactUsd, pct } from "@/components/ui/Live";
import { LISTED } from "@/config/stocks";

function Fig({ big, small }: { big: string; small: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-center md:items-start">
      <b className="font-display text-[30px] leading-none font-black text-jade" style={{ fontStretch: "112%" }}>
        {big}
      </b>
      <span className="mt-1.5 text-[13px] text-ink-3">{small}</span>
    </div>
  );
}

/** The figure beside each product line on the home page: live where the chain has an answer, a fixed fact otherwise. */
export function DeskFigure({ kind }: { kind: "lend" | "usdg" | "borrow" | "short" | "lever" | "pair" | "coin" }) {
  const { board } = useBoard();
  const live = board?.live ?? false;
  const best = (pick: (s: string) => number | null | undefined) => {
    const v = LISTED.map((s) => pick(s.symbol)).filter((x): x is number => typeof x === "number");
    return v.length ? Math.max(...v) : null;
  };
  switch (kind) {
    case "lend":
      return live ? <Fig big={pct(best((s) => rowOf(board, s)?.onixs?.short?.supplyApr))} small="best stock rent a year, live" /> : <Fig big="3" small="stocks at launch: SPY, QQQ, NVDA" />;
    case "usdg":
      return live ? <Fig big={pct(best((s) => rowOf(board, s)?.onixs?.credit?.supplyApr))} small="best USDG rate a year, live" /> : <Fig big="USDG" small="the only dollar the markets take" />;
    case "borrow":
      return <Fig big="62.5%" small="of posted stock's value, the borrow limit" />;
    case "short": {
      const depth = best((s) => {
        const r = rowOf(board, s);
        return r?.pool && r.tokenUsd ? r.pool.stock * r.tokenUsd + r.pool.usdg : null;
      });
      return <Fig big={compactUsd(depth)} small="deepest stock pool a short sells into" />;
    }
    case "lever":
      return <Fig big="1.8x" small="max, SPY / QQQ / NVDA only" />;
    case "pair":
      return (
        <div className="flex flex-wrap items-center gap-2" aria-label="For example: long NVDA, short QQQ">
          <span className="chip border-jade/50 text-jade">Long NVDA</span>
          <span className="chip border-rose/50 text-rose">Short QQQ</span>
        </div>
      );
    case "coin":
      return <Fig big="Later" small="rewards contract not deployed" />;
  }
}
