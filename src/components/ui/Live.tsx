"use client";

import { useEffect, useState } from "react";
import { useBoard, rowOf } from "@/components/BoardProvider";
import { ageLabel, feedSession } from "@/lib/session";

export const usd = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined || !Number.isFinite(n) ? "…" : `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const compactUsd = (n: number | null | undefined) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "…";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(n < 10 ? 2 : 0)}`;
};
export const pct = (n: number | null | undefined, digits = 2) => (n === null || n === undefined || !Number.isFinite(n) ? "…" : `${(n * 100).toFixed(digits)}%`);

/** Re-renders every `ms` so relative times stay true. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

/** Green dot + "Feeds updating 24/5" or amber "resting", from the New York clock. */
export function SessionPill() {
  const now = useNow();
  const s = feedSession(now);
  return (
    <span className="chip bg-white/[0.03]" data-testid="session-pill">
      <i className={`size-2 rounded-full ${s.open ? "bg-jade" : "bg-amber"}`} aria-hidden="true" />
      <span suppressHydrationWarning>{s.label}</span>
    </span>
  );
}

export function BlockPill() {
  const { board, failed } = useBoard();
  return (
    <span className="chip" data-testid="block-pill">
      <i className={`size-2 rounded-full ${board?.block ? "bg-jade" : failed ? "bg-fall" : "bg-ink-3"}`} aria-hidden="true" />
      {board?.block ? `Block ${board.block.toLocaleString("en-US")}` : failed ? "Chain unreachable, retrying" : "Reading the chain"}
    </span>
  );
}

export function FeedAge({ symbol }: { symbol: string }) {
  const { board } = useBoard();
  const now = useNow();
  const r = rowOf(board, symbol);
  if (!r?.feedUpdatedAt) return <span className="text-ink-3">…</span>;
  const age = now / 1000 - r.feedUpdatedAt;
  const stale = age > 26 * 3600;
  return (
    <span className={stale ? "text-amber" : "text-ink-2"} title={stale ? "Older than the 26 hour limit for new positions" : "Within the limit for new positions"} suppressHydrationWarning>
      {ageLabel(age)}
    </span>
  );
}
