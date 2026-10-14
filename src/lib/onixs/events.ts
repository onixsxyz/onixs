"use client";

import { useEffect, useState } from "react";
import { CHARTER, CHARTER_BLOCK, LISTINGS, charterLive } from "@/config/contracts";
import { topic } from "@/lib/calls";
import { call } from "@/lib/client";
import { readWord } from "@/lib/abi";

/*
 * Berth activity from OnixsCharter's events. Every berth reports through the Charter, so one address
 * and a bounded block range (the relay refuses wider) cover the whole protocol. Listing ids follow the
 * order of LISTINGS in src/config/contracts.ts, which is the order they were listed on chain.
 */

export const EVENTS = {
  ShortOpened: topic("ShortOpened(address,address,uint256,uint256,uint256,uint256)"),
  ShortClosed: topic("ShortClosed(address,address,uint256,uint256,uint256,uint256)"),
  LongOpened: topic("LongOpened(address,address,uint256,uint256,uint256,uint256,uint256)"),
  LongClosed: topic("LongClosed(address,address,uint256,uint256,uint256,uint256)"),
  BerthOpened: topic("BerthOpened(address,address)"),
} as const;

export type Activity = { kind: keyof typeof EVENTS; symbol: string; owner: string; label: string; block: number; tx: string; amounts: bigint[] };

const LABEL: Record<string, (a: bigint[]) => string> = {
  ShortOpened: (a) => `Short opened · ${(Number(a[2]) / 1e6).toFixed(2)} USDG from the sale`,
  ShortClosed: (a) => `Short closed · ${(Number(a[2]) / 1e6).toFixed(2)} USDG back`,
  LongOpened: (a) => `Long opened · ${(Number(a[0] + a[1]) / 1e6).toFixed(2)} USDG bought in`,
  LongClosed: (a) => `Long closed · ${(Number(a[2]) / 1e6).toFixed(2)} USDG back`,
};

type Log = { topics: string[]; data: string; blockNumber: string; transactionHash: string };

export async function readActivity(owner?: string, span = 19_000): Promise<Activity[]> {
  if (!charterLive()) return [];
  const latest = Number(BigInt(await call<string>("eth_blockNumber", [])));
  const from = Math.max(CHARTER_BLOCK, latest - span);
  const ownerTopic = owner ? `0x${owner.slice(2).toLowerCase().padStart(64, "0")}` : null;
  const kinds = ["ShortOpened", "ShortClosed", "LongOpened", "LongClosed"] as const;
  const logs = await call<Log[]>("eth_getLogs", [
    { address: CHARTER, fromBlock: `0x${from.toString(16)}`, toBlock: `0x${latest.toString(16)}`, topics: [kinds.map((k) => EVENTS[k]), ownerTopic] },
  ]);
  return logs
    .map((l): Activity | null => {
      const kind = kinds.find((k) => EVENTS[k] === l.topics[0]);
      if (!kind) return null;
      const id = Number(BigInt(l.topics[3] ?? "0x0"));
      const words = (l.data.length - 2) / 64;
      const amounts = Array.from({ length: words }, (_, i) => readWord(l.data, i));
      return {
        kind,
        symbol: (LISTINGS[id]?.symbol as string | undefined) ?? `#${id}`,
        owner: `0x${(l.topics[1] ?? "").slice(26)}`,
        label: LABEL[kind](amounts),
        block: Number(BigInt(l.blockNumber)),
        tx: l.transactionHash,
        amounts,
      };
    })
    .filter((x): x is Activity => x !== null)
    .sort((a, b) => b.block - a.block);
}

export function useCharterEvents(owner?: string) {
  const [events, setEvents] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(charterLive());
  useEffect(() => {
    if (!charterLive()) return;
    let off = false;
    const load = () =>
      readActivity(owner)
        .then((e) => !off && setEvents(e))
        .catch(() => {})
        .finally(() => !off && setLoading(false));
    load();
    const t = window.setInterval(load, 30_000);
    return () => {
      off = true;
      window.clearInterval(t);
    };
  }, [owner]);
  return { events, loading };
}
