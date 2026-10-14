import "server-only";
import { USDG } from "@/config/brand";
import { CHARTER, MORPHO, charterLive } from "@/config/contracts";
import { ALL_STOCKS, LISTED } from "@/config/stocks";
import { deskOf } from "@/lib/onixs/markets";
import { readWord } from "@/lib/abi";
import { address as addr } from "@/lib/abi";
import { rpcBatch } from "@/lib/feeds/rpc";
import { SEL, decodeState, encodeBorrowRateView, encodeMarket, marketId, rates } from "@/lib/morpho";
import { readCappedResponse } from "@/lib/server/capped";

/*
 * Everything the board shows, read from the chain on the server: each stock's Chainlink answer and age,
 * its uiMultiplier, the Uniswap pool the one-step trades fill against (price and depth), and, once ONIXS is
 * deployed, the state of its two Morpho markets per stock. What Morpho holds for these stocks today from
 * other curators comes from Morpho's public API and is labelled as such.
 */

export type StockRow = {
  symbol: string;
  listed: boolean;
  /** USD per share as the feed reports it (UI units). */
  feedUsd: number | null;
  feedUpdatedAt: number | null;
  multiplier: number | null;
  /** USD per raw token (feed × multiplier): what one token held on chain is worth. */
  tokenUsd: number | null;
  pool: { usd: number | null; stock: number; usdg: number; gapPct: number | null } | null;
  onixs: {
    short: { supply: number; borrowed: number; util: number; borrowApr: number | null; supplyApr: number | null } | null;
    credit: { supply: number; borrowed: number; util: number; borrowApr: number | null; supplyApr: number | null } | null;
  } | null;
};

export type Board = {
  at: number;
  block: number | null;
  blockTime: number | null;
  gasGwei: number | null;
  usdgUsd: number | null;
  rows: StockRow[];
  morphoToday: { markets: number; supplyUsd: number; borrowUsd: number; source: string } | null;
  live: boolean;
};

const call = (to: string, data: string) => ({ method: "eth_call", params: [{ to, data }, "latest"] });
const ok = (v: unknown): v is string => typeof v === "string" && v.length > 2;

function onixsParams(symbol: string) {
  const d = deskOf(symbol);
  return d ? { short: d.short, credit: d.credit } : null;
}

async function morphoToday(): Promise<Board["morphoToday"]> {
  const query = `{ markets(first: 100, where: { chainId_in: [4663], loanAssetAddress_in: [${LISTED.map((s) => `"${s.token}"`).join(",")}] }) { items { marketId state { supplyAssetsUsd borrowAssetsUsd } } } }`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch("https://api.morpho.org/graphql", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query }), cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return null;
    const text = await readCappedResponse(res, 400_000);
    if (!text) return null;
    const items = (JSON.parse(text)?.data?.markets?.items ?? []) as { state: { supplyAssetsUsd: number | null; borrowAssetsUsd: number | null } | null }[];
    let supplyUsd = 0;
    let borrowUsd = 0;
    for (const m of items) {
      supplyUsd += m.state?.supplyAssetsUsd ?? 0;
      borrowUsd += m.state?.borrowAssetsUsd ?? 0;
    }
    return { markets: items.length, supplyUsd, borrowUsd, source: "Morpho API, every market lending SPY, QQQ or NVDA" };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function readBoard(): Promise<Board> {
  const calls: { method: string; params: unknown[] }[] = [
    { method: "eth_getBlockByNumber", params: ["latest", false] },
    { method: "eth_gasPrice", params: [] },
    call(USDG.feed, `0x${SEL.latestRoundData}`),
  ];
  const index: Record<string, Record<string, number>> = {};
  const push = (sym: string, key: string, c: { method: string; params: unknown[] }) => {
    (index[sym] ??= {})[key] = calls.length;
    calls.push(c);
  };
  for (const s of ALL_STOCKS) {
    push(s.symbol, "feed", call(s.feed, `0x${SEL.latestRoundData}`));
    push(s.symbol, "mult", call(s.token, `0x${SEL.uiMultiplier}`));
    if (s.pool) {
      push(s.symbol, "slot0", call(s.pool, `0x${SEL.slot0}`));
      push(s.symbol, "poolStock", call(s.token, `0x${SEL.balanceOf}${addr(s.pool)}`));
      push(s.symbol, "poolUsdg", call(USDG.address, `0x${SEL.balanceOf}${addr(s.pool)}`));
    }
    const p = charterLive() ? onixsParams(s.symbol) : null;
    if (p) {
      push(s.symbol, "short", call(MORPHO.blue, encodeMarket(marketId(p.short))));
      push(s.symbol, "credit", call(MORPHO.blue, encodeMarket(marketId(p.credit))));
    }
  }
  const [results, today] = await Promise.all([rpcBatch<unknown>(calls).catch(() => calls.map(() => null)), morphoToday()]);
  const block = results[0] && typeof results[0] === "object" ? (results[0] as { number: string; timestamp: string }) : null;
  const usdgRound = ok(results[2]) ? Number(readWord(results[2], 1)) / 1e8 : null;

  // Second pass: rates need each market's state, so they are read after it.
  const rateCalls: { method: string; params: unknown[] }[] = [];
  const rateIndex: Record<string, number> = {};
  const parsed: Record<string, ReturnType<typeof decodeState>> = {};
  for (const s of ALL_STOCKS) {
    const p = charterLive() ? onixsParams(s.symbol) : null;
    if (!p) continue;
    for (const kind of ["short", "credit"] as const) {
      const r = results[index[s.symbol][kind]];
      if (!ok(r)) continue;
      const st = decodeState(r);
      parsed[`${s.symbol}:${kind}`] = st;
      rateIndex[`${s.symbol}:${kind}`] = rateCalls.length;
      rateCalls.push(call(MORPHO.adaptiveIrm, encodeBorrowRateView(p[kind], st)));
    }
  }
  const rateResults = rateCalls.length ? await rpcBatch<unknown>(rateCalls).catch(() => rateCalls.map(() => null)) : [];

  const rows: StockRow[] = ALL_STOCKS.map((s) => {
    const at = (k: string) => (index[s.symbol][k] === undefined ? null : results[index[s.symbol][k]]);
    const feed = at("feed");
    const feedUsd = ok(feed) ? Number(readWord(feed, 1)) / 1e8 : null;
    const feedUpdatedAt = ok(feed) ? Number(readWord(feed, 3)) : null;
    const mult = at("mult");
    const multiplier = ok(mult) ? Number(readWord(mult, 0)) / 1e18 : null;
    const tokenUsd = feedUsd !== null ? feedUsd * (multiplier ?? 1) : null;
    let pool: StockRow["pool"] = null;
    if (s.pool) {
      const slot = at("slot0");
      const ps = at("poolStock");
      const pu = at("poolUsdg");
      let usd: number | null = null;
      if (ok(slot)) {
        const sqrt = Number(readWord(slot, 0)) / 2 ** 96;
        const raw = sqrt * sqrt; // token1 per token0, raw units
        const stockIs0 = s.token.toLowerCase() < USDG.address.toLowerCase();
        // raw USDG (6) per raw stock (18) → USDG per token
        usd = stockIs0 ? raw * 1e12 : (1 / raw) * 1e12;
      }
      const stock = ok(ps) ? Number(readWord(ps, 0)) / 1e18 : 0;
      const usdg = ok(pu) ? Number(readWord(pu, 0)) / 1e6 : 0;
      pool = { usd, stock, usdg, gapPct: usd !== null && tokenUsd ? (usd / tokenUsd - 1) * 100 : null };
    }
    let onixs: StockRow["onixs"] = null;
    if (charterLive() && onixsParams(s.symbol)) {
      const side = (kind: "short" | "credit", dec: number) => {
        const st = parsed[`${s.symbol}:${kind}`];
        if (!st) return null;
        const r = rateResults[rateIndex[`${s.symbol}:${kind}`]];
        const rt = rates(ok(r) ? readWord(r, 0) : null, st);
        return { supply: Number(st.totalSupplyAssets) / 10 ** dec, borrowed: Number(st.totalBorrowAssets) / 10 ** dec, ...rt };
      };
      onixs = { short: side("short", 18), credit: side("credit", 6) };
    }
    return { symbol: s.symbol, listed: LISTED.some((x) => x.symbol === s.symbol), feedUsd, feedUpdatedAt, multiplier, tokenUsd, pool, onixs };
  });

  return {
    at: Date.now(),
    block: block ? Number(BigInt(block.number)) : null,
    blockTime: block ? Number(BigInt(block.timestamp)) : null,
    gasGwei: typeof results[1] === "string" ? Number(BigInt(results[1])) / 1e9 : null,
    usdgUsd: usdgRound,
    rows,
    morphoToday: today,
    live: charterLive() && CHARTER.length > 0,
  };
}
