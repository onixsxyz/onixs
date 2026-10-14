"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Board } from "@/lib/server/board";

const Ctx = createContext<{ board: Board | null; failed: boolean }>({ board: null, failed: false });

/** Polls the server's board (prices, feed ages, pools, ONIXS markets) for every page, every 20 s while visible. */
export function BoardProvider({ children }: { children: React.ReactNode }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/board", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((v: Board) => {
          if (cancelled) return;
          setBoard(v);
          setFailed(v.block === null);
        })
        .catch(() => !cancelled && setFailed(true));
    load();
    const t = window.setInterval(() => document.visibilityState === "visible" && load(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);
  return <Ctx.Provider value={{ board, failed }}>{children}</Ctx.Provider>;
}

export const useBoard = () => useContext(Ctx);
export const rowOf = (board: Board | null, symbol: string) => board?.rows.find((r) => r.symbol === symbol) ?? null;
