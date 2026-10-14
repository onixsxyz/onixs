"use client";

import { useEffect, useState } from "react";

/** The selected market from ?m=SYMBOL (read once on mount), with a default. */
export function usePick(fallback: string, allowed: string[]) {
  const [pick, setPick] = useState(fallback);
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("m")?.toUpperCase();
    // Reading the URL is a one-time sync with the outside world on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (m && allowed.includes(m)) setPick(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const choose = (s: string) => {
    setPick(s);
    const u = new URL(window.location.href);
    u.searchParams.set("m", s);
    window.history.replaceState(null, "", u);
  };
  return [pick, choose] as const;
}
