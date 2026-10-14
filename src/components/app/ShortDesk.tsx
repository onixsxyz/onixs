"use client";

import { useEffect, useState } from "react";
import { StockPicker } from "@/components/app/StockPicker";
import { Gauge } from "@/components/app/Gauge";
import { AmountField, ActionButton } from "@/components/app/Gate";
import { usePick } from "@/components/app/usePick";
import { useBoard, rowOf } from "@/components/BoardProvider";
import { FeedAge, pct, usd } from "@/components/ui/Live";
import { useWallet } from "@/components/wallet/WalletProvider";
import { USDG } from "@/config/brand";
import { charterLive } from "@/config/contracts";
import { LISTED, LISTING_PARAMS, findListed } from "@/config/stocks";
import { formatUnits, parseUnits } from "@/lib/client";
import { berthCalls } from "@/lib/onixs/calls";
import { berthAddress, ensureBerth } from "@/lib/onixs/berth";
import { deskOf } from "@/lib/onixs/markets";
import { usePortfolio } from "@/lib/onixs/portfolio";
import { costToBuy, sellStock } from "@/lib/onixs/quote";
import { useRunner } from "@/lib/onixs/runner";

const n = (v: bigint, d: number) => Number(v) / 10 ** d;

/** Debounced pool quote for whatever `amount` is. */
export function useQuote(fn: (a: bigint) => Promise<bigint>, amount: bigint, key: string) {
  const [q, setQ] = useState<bigint | null>(null);
  useEffect(() => {
    let off = false;
    const t = window.setTimeout(() => {
      if (amount <= 0n) return setQ(null);
      fn(amount).then((v) => !off && setQ(v)).catch(() => !off && setQ(null));
    }, 350);
    return () => {
      off = true;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, key]);
  return q;
}

export function ShortDesk() {
  const [symbol, setSymbol] = usePick("QQQ", LISTED.map((s) => s.symbol));
  const { board } = useBoard();
  const stock = findListed(symbol)!;
  const desk = deskOf(symbol);
  const live = charterLive() && Boolean(desk);
  const P = LISTING_PARAMS[symbol];
  const row = rowOf(board, symbol);
  const price = row?.tokenUsd ?? null;
  const { address } = useWallet();
  const [tick, setTick] = useState(0);
  const { data } = usePortfolio(address, tick);
  const [margin, setMargin] = useState("");
  const [size, setSize] = useState("");
  const m = parseUnits(margin, 6) ?? 0n;
  const s = parseUnits(size, 18) ?? 0n;
  const proceeds = useQuote((a) => sellStock(stock.token, a), s, stock.token);
  const held = n(m, 6) + (proceeds ? n(proceeds, 6) : 0);
  const debtUsd = price ? n(s, 18) * price : null;
  const ltv = debtUsd !== null && held > 0 ? debtUsd / held : null;
  const liq = s > 0n ? (P.shortLltv * held) / n(s, 18) : null;
  const overOpen = ltv !== null && ltv > P.shortOpenLtv;
  const mine = data?.desks.find((d) => d.symbol === symbol)?.berthShort ?? null;
  const buyBack = useQuote((a) => costToBuy(stock.token, a), mine ? mine.stockOwed + mine.stockOwed / 5000n + 1n : 0n, `${stock.token}:${tick}`);
  const open = useRunner();
  const close = useRunner();
  const fillStock = () => {
    // Largest size that stays inside the opening limit: s·p ≤ L·(M + s·p) → s·p ≤ L·M/(1−L), with 1% room for the pool.
    if (!price || m <= 0n) return;
    const usdMax = ((P.shortOpenLtv * n(m, 6)) / (1 - P.shortOpenLtv)) * 0.97;
    setSize((usdMax / price).toFixed(6));
  };

  return (
    <>
      <StockPicker value={symbol} onChange={setSymbol} note={(x) => (board?.live ? (() => { const r = rowOf(board, x)?.onixs?.short?.borrowApr; return r === null || r === undefined ? null : `${(r * 100).toFixed(2)}% rent`; })() : null)} />
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="slab min-w-0 p-5 sm:p-6" data-testid="short-panel">
          <h2 className="text-[22px] font-bold">Short {symbol}</h2>
          <div className="mt-5">
            <Gauge used={ltv !== null ? ltv / P.shortLltv : null} label="of the liquidation line" />
          </div>
          <AmountField label="Margin" unit="USDG" value={margin} onChange={setMargin} hint={address ? `Wallet: ${data ? formatUnits(data.usdg, 6, 2) : "…"}` : "No wallet yet"} testid="short-margin" />
          <AmountField label={`${symbol} to borrow and sell`} unit={symbol} value={size} onChange={setSize} onMax={m > 0n && price ? fillStock : undefined} testid="short-size" />
          <div className="mt-4">
            <div className="kv"><span>The sale brings</span><span>{proceeds ? `${formatUnits(proceeds, 6, 2)} USDG` : "…"}</span></div>
            <div className="kv"><span>USDG behind it</span><span>{held > 0 ? usd(held) : "…"}</span></div>
            <div className="kv"><span>Opening limit</span><span>{(P.shortOpenLtv * 100).toFixed(0)}% · liquidation at {(P.shortLltv * 100).toFixed(1)}%</span></div>
            <div className={`kv ${overOpen ? "text-fall" : ""}`}><span>Used after this</span><span>{ltv !== null ? `${(ltv * 100).toFixed(1)}%` : "…"}</span></div>
            <div className="kv"><span>Liquidated if {symbol} reaches</span><span>{liq ? usd(liq) : "…"}</span></div>
            <div className="kv"><span>Rent you pay, a year (floats)</span><span>{live ? pct(row?.onixs?.short?.borrowApr) : "Starts at launch"}</span></div>
            <div className="kv"><span>Price feed</span><span><FeedAge symbol={symbol} /></span></div>
            <div className="kv"><span>ONIXS fee</span><span>None</span></div>
          </div>
          {row?.pool && price && s > 0n && n(s, 18) > row.pool.stock * 0.1 ? (
            <p className="mt-4 rounded-lg border border-amber/40 px-3 py-2.5 text-[13px] text-amber" data-testid="depth-warning">
              This is over a tenth of the {formatUnits(BigInt(Math.floor(row.pool.stock * 1e6)) * 10n ** 12n, 18, 2)} {symbol} the pool holds. Buying it back, by you or by a liquidator, could move the price a lot or not fill at all.
            </p>
          ) : null}
          <ActionButton
            live={live}
            ready={m > 0n && s > 0n && proceeds !== null && !overOpen && Boolean(data && m <= data.usdg)}
            label="Open the short"
            state={open}
            testid="short-go"
            onRun={async () => {
              if (!desk || !address || !proceeds) return;
              const minOut = (proceeds * 99n) / 100n;
              const ok = await open.run(
                [
                  ...ensureBerth(data?.berth ?? null),
                  { kind: "approve", label: "Approve your margin", token: USDG.address, spender: berthAddress(address), amount: m },
                  { kind: "call", label: `Short ${symbol}`, to: berthAddress(address), data: berthCalls.openShort(desk.id, m, s, minOut) },
                ],
                `${size} ${symbol} shorted.`,
              );
              if (ok) {
                setMargin("");
                setSize("");
                setTick((t) => t + 1);
              }
            }}
          />
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
            The first short asks for three signatures: open your berth (once per wallet), approve the margin, then short. A rising stock
            costs you money, up to the whole margin.
          </p>
        </div>

        <div className="slab min-w-0 p-5 sm:p-6" data-testid="short-mine">
          <h2 className="text-[22px] font-bold">{symbol} short, your side</h2>
          <div className="mt-3">
            <div className="kv"><span>Debt</span><span>{!address ? "No wallet yet" : mine ? `${formatUnits(mine.stockOwed, 18, 6)} ${symbol}` : "No short open"}</span></div>
            <div className="kv"><span>USDG collateral</span><span>{mine ? `${formatUnits(mine.usdgHeld, 6, 2)} USDG` : "…"}</span></div>
            <div className="kv"><span>Used of the liquidation line</span><span>{mine && price ? `${(((n(mine.stockOwed, 18) * price) / n(mine.usdgHeld, 6) / P.shortLltv) * 100).toFixed(1)}%` : "…"}</span></div>
            <div className="kv"><span>Liquidated if {symbol} reaches</span><span>{mine && mine.stockOwed > 0n ? usd((P.shortLltv * n(mine.usdgHeld, 6)) / n(mine.stockOwed, 18)) : "…"}</span></div>
            <div className="kv"><span>{symbol} now</span><span>{usd(price)}</span></div>
            <div className="kv"><span>Buying it back costs</span><span>{buyBack ? `${formatUnits(buyBack, 6, 2)} USDG` : "…"}</span></div>
            <div className="kv font-semibold"><span className="!text-ink">Closing now returns</span><span>{mine && buyBack ? `${formatUnits(mine.usdgHeld > buyBack ? mine.usdgHeld - buyBack : 0n, 6, 2)} USDG` : "…"}</span></div>
          </div>
          <ActionButton
            live={live}
            ready={Boolean(mine && buyBack)}
            label="Close the short"
            state={close}
            onRun={async () => {
              if (!desk || !address || !buyBack) return;
              const maxIn = (buyBack * 102n) / 100n;
              // If the buy-back costs more than the USDG held, the berth pulls only the gap from the wallet.
              const gap = mine && maxIn > mine.usdgHeld ? maxIn - mine.usdgHeld : 0n;
              const ok = await close.run(
                [
                  { kind: "approve", label: "Approve the shortfall", token: USDG.address, spender: berthAddress(address), amount: gap },
                  { kind: "call", label: "Close the short", to: berthAddress(address), data: berthCalls.closeShort(desk.id, maxIn) },
                ],
                "Short closed. The rest of the USDG is in your wallet.",
              );
              if (ok) setTick((t) => t + 1);
            }}
          />
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
            Closing buys the stock back on the pool with the USDG held against it, repays it, and sends you the remainder. It works at any hour,
            weekends included: it needs the pool, not the feed.
          </p>
        </div>
      </div>
    </>
  );
}
