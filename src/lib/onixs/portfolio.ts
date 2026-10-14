"use client";

import { useEffect, useState } from "react";
import { USDG } from "@/config/brand";
import { CHARTER, MORPHO, charterLive } from "@/config/contracts";
import { LISTED } from "@/config/stocks";
import { encodeBalanceOf } from "@/lib/calls";
import { readWord, readAddress } from "@/lib/abi";
import { rpcBatch } from "@/lib/rpc";
import { decodePosition, decodeState, encodeMarket, encodePosition, toAssetsDown, toAssetsUp, type MarketState, type Position } from "@/lib/morpho";
import { charterCalls, leaseholdCalls } from "@/lib/onixs/calls";
import { desks } from "@/lib/onixs/markets";

/*
 * One wallet's whole picture, read straight from the chain: token balances, leasehold shares and what they
 * are worth in stock, the wallet's own Morpho positions (USDG lent, shares posted, USDG borrowed) and its
 * berth's positions (shorts and leveraged longs). Before the contracts exist only token balances are read.
 */

export type DeskPosition = {
  symbol: string;
  stockBalance: bigint;
  shares: bigint;
  sharesInStock: bigint;
  available: bigint;
  /** Raw stock for 1e24 raw shares (one whole share): convertToAssets(1e24). */
  perShare: bigint;
  short: MarketState | null;
  credit: MarketState | null;
  /** The wallet's own position in the credit market (USDG lent, shares posted, USDG borrowed). */
  mine: { usdgLent: bigint; posted: bigint; usdgOwed: bigint; raw: Position } | null;
  /** The berth's short (stock owed, USDG held) and leveraged long (USDG owed, shares posted). */
  berthShort: { stockOwed: bigint; usdgHeld: bigint } | null;
  berthLong: { usdgOwed: bigint; posted: bigint } | null;
};

export type Portfolio = { user: string; usdg: bigint; eth: bigint | null; berth: string | null; desks: DeskPosition[]; stocks: Record<string, bigint>; at: number };

const call = (to: string, data: string) => ({ method: "eth_call", params: [{ to, data }, "latest"] });
const ZERO = /^0x0{40}$/;

async function batch(calls: { method: string; params: unknown[] }[]) {
  if (!calls.length) return [] as (string | null)[];
  const out = await rpcBatch<string | null>(calls);
  return out.map((v) => (typeof v === "string" && v !== "0x" ? v : null));
}

export async function readPortfolio(user: string): Promise<Portfolio> {
  const list = desks();
  const first = [call(USDG.address, encodeBalanceOf(user)), ...LISTED.map((s) => call(s.token, encodeBalanceOf(user)))];
  if (charterLive()) first.push(call(CHARTER, charterCalls.berthOf(user)));
  for (const d of list) {
    first.push(call(d.leasehold, encodeBalanceOf(user)), call(d.leasehold, leaseholdCalls.available()), call(MORPHO.blue, encodeMarket(d.shortId)), call(MORPHO.blue, encodeMarket(d.creditId)), call(MORPHO.blue, encodePosition(d.creditId, user)), call(d.leasehold, leaseholdCalls.convertToAssets(10n ** 24n)));
  }
  const r = await batch(first);
  const usdg = r[0] ? readWord(r[0], 0) : 0n;
  const stocks: Record<string, bigint> = {};
  LISTED.forEach((s, i) => (stocks[s.symbol] = r[1 + i] ? readWord(r[1 + i]!, 0) : 0n));
  let k = 1 + LISTED.length;
  let berth: string | null = null;
  if (charterLive()) {
    const b = r[k++];
    berth = b ? readAddress(b, 0) : null;
    if (berth && ZERO.test(berth)) berth = null;
  }
  const partial = list.map((d) => {
    const shares = r[k] ? readWord(r[k]!, 0) : 0n;
    const available = r[k + 1] ? readWord(r[k + 1]!, 0) : 0n;
    const short = r[k + 2] ? decodeState(r[k + 2]!) : null;
    const credit = r[k + 3] ? decodeState(r[k + 3]!) : null;
    const pos = r[k + 4] ? decodePosition(r[k + 4]!) : null;
    const perShare = r[k + 5] ? readWord(r[k + 5]!, 0) : 10n ** 18n / 10n ** 6n;
    k += 6;
    return { d, shares, available, short, credit, pos, perShare };
  });

  const second: { method: string; params: unknown[] }[] = [];
  for (const p of partial) {
    second.push(call(p.d.leasehold, leaseholdCalls.convertToAssets(p.shares)));
    if (berth) second.push(call(MORPHO.blue, encodePosition(p.d.shortId, berth)), call(MORPHO.blue, encodePosition(p.d.creditId, berth)));
  }
  const r2 = await batch(second);
  let j = 0;
  const out: DeskPosition[] = partial.map((p) => {
    const inStock = r2[j] ? readWord(r2[j]!, 0) : 0n;
    j++;
    let berthShort: DeskPosition["berthShort"] = null;
    let berthLong: DeskPosition["berthLong"] = null;
    if (berth) {
      const sp = r2[j] ? decodePosition(r2[j]!) : null;
      const lp = r2[j + 1] ? decodePosition(r2[j + 1]!) : null;
      j += 2;
      if (sp && p.short && (sp.borrowShares > 0n || sp.collateral > 0n)) berthShort = { stockOwed: toAssetsUp(sp.borrowShares, p.short.totalBorrowAssets, p.short.totalBorrowShares), usdgHeld: sp.collateral };
      if (lp && p.credit && (lp.borrowShares > 0n || lp.collateral > 0n)) berthLong = { usdgOwed: toAssetsUp(lp.borrowShares, p.credit.totalBorrowAssets, p.credit.totalBorrowShares), posted: lp.collateral };
    }
    const mine =
      p.pos && p.credit
        ? {
            usdgLent: toAssetsDown(p.pos.supplyShares, p.credit.totalSupplyAssets, p.credit.totalSupplyShares),
            posted: p.pos.collateral,
            usdgOwed: toAssetsUp(p.pos.borrowShares, p.credit.totalBorrowAssets, p.credit.totalBorrowShares),
            raw: p.pos,
          }
        : null;
    return { symbol: p.d.symbol, stockBalance: stocks[p.d.symbol] ?? 0n, shares: p.shares, sharesInStock: inStock, available: p.available, perShare: p.perShare, short: p.short, credit: p.credit, mine, berthShort, berthLong };
  });
  return { user: user.toLowerCase(), usdg, eth: null, berth, desks: out, stocks, at: Date.now() };
}

export function usePortfolio(address: string | null, refresh = 0) {
  const [data, setData] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!address) return;
    let off = false;
    const load = () =>
      readPortfolio(address)
        .then((p) => {
          if (off) return;
          setData(p);
          setError(null);
        })
        .catch(() => !off && setError("Could not read the wallet from the chain. Retrying."));
    load();
    const t = window.setInterval(load, 25_000);
    return () => {
      off = true;
      window.clearInterval(t);
    };
  }, [address, refresh]);
  // A disconnected wallet shows nothing, even if an older read is still in state.
  return { data: address && data && data.user === address.toLowerCase() ? data : null, error: address ? error : null };
}

/** Raw stock held by `shares` raw leasehold shares, at the share price just read. */
export const sharesToStock = (shares: bigint, perShare: bigint) => (shares * perShare) / 10n ** 24n;
