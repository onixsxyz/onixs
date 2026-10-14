import "server-only";
import { USDG } from "@/config/brand";
import { CHARTER, LISTINGS, MORPHO, UNISWAP_V3, charterLive } from "@/config/contracts";
import { LISTED, LISTING_PARAMS, STOCK_BEACON } from "@/config/stocks";
import { address as addr, readAddress, readWord, word } from "@/lib/abi";
import { decodeStringAt, selector } from "@/lib/calls";
import { rpcBatch } from "@/lib/feeds/rpc";

/*
 * The checks behind the Verify tab, run on the server against the chain: that each stock token is an
 * official one (beacon in its code, exact symbol, issuer's name suffix), that each feed names the same
 * stock, that each pool pairs that stock with the real USDG, that Morpho accepts the rate model and the
 * limits ONIXS uses, and, once deployed, that every ONIXS contract has code where config says.
 */

export type Check = { group: string; label: string; address: string; ok: boolean | null; detail: string };

const c = (to: string, data: string) => ({ method: "eth_call", params: [{ to, data }, "latest"] });
const code = (a: string) => ({ method: "eth_getCode", params: [a, "latest"] });
const sel = (s: string) => `0x${selector(s)}`;
const ok = (v: unknown): v is string => typeof v === "string" && v.length > 2;

let cache: { at: number; value: Check[] } | null = null;

export async function runChecks(): Promise<Check[]> {
  if (cache && Date.now() - cache.at < 120_000) return cache.value;
  const calls: { method: string; params: unknown[] }[] = [];
  const at = (x: { method: string; params: unknown[] }) => calls.push(x) - 1;
  const plan = LISTED.map((s) => ({
    s,
    code: at(code(s.token)),
    name: at(c(s.token, sel("name()"))),
    symbol: at(c(s.token, sel("symbol()"))),
    desc: at(c(s.feed, sel("description()"))),
    t0: s.pool ? at(c(s.pool, sel("token0()"))) : -1,
    t1: s.pool ? at(c(s.pool, sel("token1()"))) : -1,
    fee: s.pool ? at(c(s.pool, sel("fee()"))) : -1,
  }));
  const morphoCode = at(code(MORPHO.blue));
  const irm = at(c(MORPHO.blue, `${sel("isIrmEnabled(address)")}${addr(MORPHO.adaptiveIrm)}`));
  const lltvs = [...new Set(Object.values(LISTING_PARAMS).flatMap((p) => [p.shortLltv, p.creditLltv]))];
  const lltvIdx = lltvs.map((l) => at(c(MORPHO.blue, `${sel("isLltvEnabled(uint256)")}${word(BigInt(Math.round(l * 1000)) * 10n ** 15n)}`)));
  const usdgSym = at(c(USDG.address, sel("symbol()")));
  const usdgDec = at(c(USDG.address, sel("decimals()")));
  const quoter = at(code(UNISWAP_V3.quoterV2));
  const ours = charterLive() ? [CHARTER, ...LISTINGS.flatMap((l) => [l.shortMark, l.leasehold, l.creditMark])].map((a) => ({ a, i: at(code(a)) })) : [];

  const r = await rpcBatch<unknown>(calls).catch(() => calls.map(() => null));
  const str = (i: number) => (ok(r[i]) ? decodeStringAt(r[i] as string) : null);
  const out: Check[] = [];
  for (const p of plan) {
    const hasBeacon = ok(r[p.code]) && (r[p.code] as string).toLowerCase().includes(STOCK_BEACON.slice(2));
    const name = str(p.name);
    const symbol = str(p.symbol);
    out.push({ group: "Stock tokens", label: `${p.s.symbol} is an official Robinhood stock token`, address: p.s.token, ok: r[p.code] ? hasBeacon && symbol === p.s.symbol && Boolean(name?.endsWith("Robinhood Token")) : null, detail: name ? `${name} · symbol ${symbol} · beacon ${hasBeacon ? "found" : "missing"}` : "unread" });
    const desc = str(p.desc);
    out.push({ group: "Price feeds", label: `${p.s.symbol} feed prices ${p.s.symbol}`, address: p.s.feed, ok: desc === null ? null : desc.includes(p.s.symbol), detail: desc ?? "unread" });
    if (p.s.pool) {
      const t0 = ok(r[p.t0]) ? readAddress(r[p.t0] as string, 0).toLowerCase() : null;
      const t1 = ok(r[p.t1]) ? readAddress(r[p.t1] as string, 0).toLowerCase() : null;
      const fee = ok(r[p.fee]) ? Number(readWord(r[p.fee] as string, 0)) : null;
      const pair = new Set([t0, t1]);
      out.push({ group: "Pools", label: `${p.s.symbol}/USDG pool pairs the real tokens`, address: p.s.pool, ok: t0 === null ? null : pair.has(p.s.token.toLowerCase()) && pair.has(USDG.address.toLowerCase()) && fee === 500, detail: fee !== null ? `fee ${fee / 10_000}%` : "unread" });
    }
  }
  out.push({ group: "Morpho", label: "Morpho Blue has code", address: MORPHO.blue, ok: r[morphoCode] ? (r[morphoCode] as string).length > 2 : null, detail: "core lending contract" });
  out.push({ group: "Morpho", label: "Adaptive rate model is enabled on Morpho", address: MORPHO.adaptiveIrm, ok: ok(r[irm]) ? readWord(r[irm] as string, 0) === 1n : null, detail: "isIrmEnabled" });
  lltvs.forEach((l, i) => out.push({ group: "Morpho", label: `Limit ${(l * 100).toFixed(1)}% is enabled on Morpho`, address: MORPHO.blue, ok: ok(r[lltvIdx[i]]) ? readWord(r[lltvIdx[i]] as string, 0) === 1n : null, detail: "isLltvEnabled" }));
  const us = str(usdgSym);
  out.push({ group: "Tokens", label: "USDG is the real Global Dollar", address: USDG.address, ok: us === null ? null : us === "USDG" && ok(r[usdgDec]) && readWord(r[usdgDec] as string, 0) === 6n, detail: `${us ?? "?"} · 6 decimals` });
  out.push({ group: "Pools", label: "Uniswap QuoterV2 has code", address: UNISWAP_V3.quoterV2, ok: r[quoter] ? (r[quoter] as string).length > 2 : null, detail: "used for every quote on this site" });
  for (const o of ours) out.push({ group: "ONIXS contracts", label: "Contract has code", address: o.a, ok: r[o.i] ? (r[o.i] as string).length > 2 : null, detail: "verify-deployment checks the creation transaction too" });
  if (!charterLive()) out.push({ group: "ONIXS contracts", label: "Charter, leaseholds and price marks", address: "", ok: null, detail: "Not deployed yet. They appear here, with their source on Blockscout, at launch." });
  if (r.some((x) => x !== null)) cache = { at: Date.now(), value: out };
  return out;
}
