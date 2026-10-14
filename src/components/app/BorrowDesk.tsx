"use client";

import { useEffect, useState } from "react";
import { StockPicker } from "@/components/app/StockPicker";
import { Gauge } from "@/components/app/Gauge";
import { AmountField, ActionButton } from "@/components/app/Gate";
import { usePick } from "@/components/app/usePick";
import { useBoard, rowOf } from "@/components/BoardProvider";
import { pct, usd } from "@/components/ui/Live";
import { useWallet } from "@/components/wallet/WalletProvider";
import { USDG } from "@/config/brand";
import { MORPHO, charterLive } from "@/config/contracts";
import { LISTED, LISTING_PARAMS, findListed } from "@/config/stocks";
import { encodeBalanceOf, wordAt } from "@/lib/calls";
import { ethCall, formatUnits, parseUnits } from "@/lib/client";
import { encodeBorrow, encodeRepay, encodeSupplyCollateral, encodeWithdrawCollateral } from "@/lib/morpho";
import { berthCalls, leaseholdCalls } from "@/lib/onixs/calls";
import { berthAddress, ensureBerth } from "@/lib/onixs/berth";
import { deskOf } from "@/lib/onixs/markets";
import { sharesToStock, usePortfolio } from "@/lib/onixs/portfolio";
import { buyStockWith, sellStock } from "@/lib/onixs/quote";
import { useRunner } from "@/lib/onixs/runner";

const toNum = (v: bigint, d: number) => Number(v) / 10 ** d;

export function BorrowDesk() {
  const [pick, setPick] = usePick("NVDA", LISTED.map((s) => s.symbol));
  const { board } = useBoard();
  const symbol = pick;
  const stock = findListed(symbol)!;
  const desk = deskOf(symbol);
  const live = charterLive() && Boolean(desk);
  const lltv = LISTING_PARAMS[symbol].creditLltv;
  const { address } = useWallet();
  const [tick, setTick] = useState(0);
  const { data } = usePortfolio(address, tick);
  const row = rowOf(board, symbol);
  const pos = data?.desks.find((d) => d.symbol === symbol) ?? null;
  const price = row?.tokenUsd ?? null;
  const posted = pos?.mine ? sharesToStock(pos.mine.posted, pos.perShare) : 0n;
  const owed = pos?.mine?.usdgOwed ?? 0n;
  const postedUsd = price ? toNum(posted, 18) * price : null;

  const [borrow, setBorrow] = useState("");
  const [post, setPost] = useState("");
  const [repay, setRepay] = useState("");
  const [back, setBack] = useState("");
  const rb = parseUnits(borrow, 6) ?? 0n;
  const rp = parseUnits(post, 18) ?? 0n;
  const owedAfter = toNum(owed + rb, 6);
  const postedAfterUsd = price ? (toNum(posted, 18) + toNum(rp, 18)) * price : null;
  const usedAfter = postedAfterUsd ? owedAfter / (postedAfterUsd * lltv) : null;
  const liqPrice = posted + rp > 0n ? owedAfter / (lltv * toNum(posted + rp, 18)) : null;
  const free = row?.onixs?.credit ? row.onixs.credit.supply - row.onixs.credit.borrowed : null;

  const runBorrow = useRunner();
  const runPost = useRunner();
  const runRepay = useRunner();
  const runBack = useRunner();
  const refresh = () => setTick((t) => t + 1);

  return (
    <>
      <StockPicker value={symbol} onChange={setPick} note={(s) => (board?.live ? (() => { const r = rowOf(board, s)?.onixs?.credit?.borrowApr; return r === null || r === undefined ? null : `${(r * 100).toFixed(2)}% loan`; })() : null)} />
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="slab min-w-0 p-5 sm:p-6" data-testid="borrow-panel">
          <h2 className="text-[22px] font-bold">Borrow USDG against {symbol}</h2>
          <div className="mt-5">
            <Gauge used={usedAfter} label="of your borrowing room" />
          </div>
          <AmountField label="Borrow amount" unit="USDG" value={borrow} onChange={setBorrow} testid="borrow-amount" />
          <ActionButton
            live={live}
            ready={rb > 0n && usedAfter !== null && usedAfter < 0.95}
            label="Borrow USDG"
            state={runBorrow}
            onRun={async () => {
              if (!desk || !address) return;
              const ok = await runBorrow.run([{ kind: "call", label: "Borrow USDG", to: MORPHO.blue, data: encodeBorrow(desk.credit, rb, 0n, address, address) }], `${borrow} USDG borrowed.`);
              if (ok) {
                setBorrow("");
                refresh();
              }
            }}
          />
          <div className="mt-5">
            <div className="kv"><span>Collateral posted</span><span>{address ? `${formatUnits(posted, 18, 4)} ${symbol}` : "No wallet yet"}</span></div>
            <div className="kv"><span>Posted value</span><span>{usd(postedUsd)}</span></div>
            <div className="kv"><span>Loan ceiling</span><span>{(lltv * 100).toFixed(1)}% of it</span></div>
            <div className="kv"><span>Loan rate, a year (floats)</span><span>{live ? pct(row?.onixs?.credit?.borrowApr) : "Starts at launch"}</span></div>
            <div className="kv"><span>USDG available in this market</span><span>{live ? usd(free, 0) : "…"}</span></div>
            <div className="kv"><span>Liquidation price after this</span><span>{liqPrice && Number.isFinite(liqPrice) && owedAfter > 0 ? usd(liqPrice) : "No loan"}</span></div>
          </div>
        </div>

        <div className="slab min-w-0 p-5 sm:p-6">
          <h2 className="text-[22px] font-bold">{symbol} loan, your side</h2>
          <div className="mt-3">
            <div className="kv"><span>Debt</span><span>{address ? `${formatUnits(owed, 6, 2)} USDG` : "No wallet yet"}</span></div>
            <div className="kv"><span>Limit used</span><span>{postedUsd ? `${((toNum(owed, 6) / (postedUsd * lltv)) * 100).toFixed(1)}%` : "…"}</span></div>
          </div>

          <h3 className="mt-6 text-[16px] font-semibold">Lend and post more {symbol}</h3>
          <AmountField label={`${symbol} to add as collateral`} unit={symbol} value={post} onChange={setPost} hint={data ? `Wallet: ${formatUnits(data.stocks[symbol] ?? 0n, 18, 4)}` : undefined} testid="post-amount" />
          <ActionButton
            live={live}
            ready={rp > 0n && rp <= (data?.stocks[symbol] ?? 0n)}
            label="Lend and post"
            state={runPost}
            onRun={async () => {
              if (!desk || !address) return;
              const before = wordAt(await ethCall(desk.leasehold, encodeBalanceOf(address)), 0);
              const newShares = async () => wordAt(await ethCall(desk.leasehold, encodeBalanceOf(address)), 0) - before;
              const ok = await runPost.run(
                [
                  { kind: "approve", label: `Approve ${symbol}`, token: stock.token, spender: desk.leasehold, amount: rp },
                  { kind: "call", label: `Lend ${symbol}`, to: desk.leasehold, data: leaseholdCalls.deposit(rp, address) },
                  { kind: "approve", label: "Approve the new shares", token: desk.leasehold, spender: MORPHO.blue, amount: newShares },
                  { kind: "call", label: "Post them as collateral", to: MORPHO.blue, data: async () => encodeSupplyCollateral(desk.credit, await newShares(), address) },
                ],
                `${post} ${symbol} lent and posted; rent keeps accruing on it.`,
              );
              if (ok) {
                setPost("");
                refresh();
              }
            }}
          />
          {pos && pos.shares > 0n ? (
            <p className="mt-3 text-[12.5px] text-ink-3">
              You also hold {formatUnits(pos.shares, 24, 4)} leasehold shares that are not posted.{" "}
              <button
                type="button"
                className="link"
                disabled={!live || runPost.busy}
                onClick={() =>
                  desk && address &&
                  runPost.run(
                    [
                      { kind: "approve", label: "Approve shares", token: desk.leasehold, spender: MORPHO.blue, amount: pos.shares },
                      { kind: "call", label: "Post shares", to: MORPHO.blue, data: encodeSupplyCollateral(desk.credit, pos.shares, address) },
                    ],
                    "Shares posted.",
                  ).then((ok) => ok && refresh())
                }
              >
                Post them
              </button>
            </p>
          ) : null}

          <h3 className="mt-6 text-[16px] font-semibold">Repay</h3>
          <AmountField label="USDG to repay" unit="USDG" value={repay} onChange={setRepay} hint={data ? `Wallet: ${formatUnits(data.usdg, 6, 2)}` : undefined} />
          <div className="flex flex-wrap gap-2">
            <ActionButton
              live={live}
              ready={(parseUnits(repay, 6) ?? 0n) > 0n}
              label="Repay"
              state={runRepay}
              onRun={async () => {
                const amt = parseUnits(repay, 6);
                if (!desk || !address || !amt) return;
                const ok = await runRepay.run(
                  [
                    { kind: "approve", label: "Approve USDG", token: USDG.address, spender: MORPHO.blue, amount: amt },
                    { kind: "call", label: "Repay", to: MORPHO.blue, data: encodeRepay(desk.credit, amt, 0n, address) },
                  ],
                  "Repaid.",
                );
                if (ok) {
                  setRepay("");
                  refresh();
                }
              }}
            />
          </div>
          <button
            type="button"
            className="btn btn-sm btn-line mt-3"
            disabled={!live || !pos?.mine || pos.mine.raw.borrowShares === 0n || runRepay.busy}
            onClick={() => {
              if (!desk || !address || !pos?.mine) return;
              // Repaying by shares clears the debt exactly; the approval leaves room for a few seconds of interest.
              const cushion = pos.mine.usdgOwed + pos.mine.usdgOwed / 1000n + 10n;
              runRepay
                .run(
                  [
                    { kind: "approve", label: "Approve USDG", token: USDG.address, spender: MORPHO.blue, amount: cushion },
                    { kind: "call", label: "Repay everything", to: MORPHO.blue, data: encodeRepay(desk.credit, 0n, pos.mine.raw.borrowShares, address) },
                  ],
                  "Loan repaid in full.",
                )
                .then((ok) => ok && refresh());
            }}
          >
            Repay everything
          </button>

          <h3 className="mt-6 text-[16px] font-semibold">Take back posted shares</h3>
          <AmountField label="Shares to take back" unit="shares" value={back} onChange={setBack} onMax={pos?.mine?.posted ? () => setBack(formatUnits(pos.mine!.posted, 24, 24).replace(/,/g, "")) : undefined} />
          <ActionButton
            live={live}
            ready={(parseUnits(back, 24) ?? 0n) > 0n && (parseUnits(back, 24) ?? 0n) <= (pos?.mine?.posted ?? 0n)}
            label="Take back"
            state={runBack}
            onRun={async () => {
              const sh = parseUnits(back, 24);
              if (!desk || !address || !sh) return;
              const ok = await runBack.run([{ kind: "call", label: "Take back shares", to: MORPHO.blue, data: encodeWithdrawCollateral(desk.credit, sh, address, address) }], "Shares back in your wallet (still lent).");
              if (ok) {
                setBack("");
                refresh();
              }
            }}
          />
        </div>
      </div>
    </>
  );
}

const LEVER = ["SPY", "QQQ", "NVDA"];

export function LeverDesk() {
  const [symbol, setSymbol] = useState("NVDA");
  const { board } = useBoard();
  const stock = findListed(symbol)!;
  const desk = deskOf(symbol);
  const live = charterLive() && Boolean(desk);
  const max = LISTING_PARAMS[symbol].maxLeverage;
  const lltv = LISTING_PARAMS[symbol].creditLltv;
  const { address } = useWallet();
  const [tick, setTick] = useState(0);
  const { data } = usePortfolio(address, tick);
  const row = rowOf(board, symbol);
  const [margin, setMargin] = useState("");
  const [lev, setLev] = useState(1.5);
  const [agree, setAgree] = useState(false);
  const [quote, setQuote] = useState<bigint | null>(null);
  const m = parseUnits(margin, 6) ?? 0n;
  const loan = (m * BigInt(Math.round((lev - 1) * 1000))) / 1000n;
  useEffect(() => {
    let off = false;
    const t = window.setTimeout(() => {
      if (m + loan <= 0n) return setQuote(null);
      buyStockWith(stock.token, m + loan).then((q) => !off && setQuote(q)).catch(() => !off && setQuote(null));
    }, 350);
    return () => {
      off = true;
      window.clearTimeout(t);
    };
  }, [m, loan, stock.token]);
  const sizeUsd = quote && row?.tokenUsd ? toNum(quote, 18) * row.tokenUsd : null;
  const liq = quote && quote > 0n ? toNum(loan, 6) / (lltv * toNum(quote, 18)) : null;
  const pos = data?.desks.find((d) => d.symbol === symbol)?.berthLong ?? null;
  const perShare = data?.desks.find((d) => d.symbol === symbol)?.perShare ?? 10n ** 12n;
  const open = useRunner();
  const close = useRunner();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
      <div className="slab min-w-0 p-5 sm:p-6" data-testid="lever-panel">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Stock">
          {LEVER.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={symbol === s} onClick={() => setSymbol(s)} className={`chip !h-9 !px-3.5 text-[13.5px] ${symbol === s ? "!border-amber text-ink" : ""}`}>
              {s} · up to {LISTING_PARAMS[s].maxLeverage}x
            </button>
          ))}
        </div>
        <AmountField label="Your margin" unit="USDG" value={margin} onChange={setMargin} hint={address ? `Wallet: ${data ? formatUnits(data.usdg, 6, 2) : "…"}` : "No wallet yet"} testid="lever-margin" />
        <label className="mt-5 block">
          <span className="flex justify-between text-[13.5px]">
            <span className="font-semibold">Leverage {lev.toFixed(2)}x</span>
            <span className="text-ink-3">up to {max}x on {symbol}</span>
          </span>
          <input type="range" min={1.1} max={max} step={0.05} value={lev} onChange={(e) => setLev(Number(e.target.value))} className="mt-3 w-full accent-amber" aria-label="Leverage" />
        </label>
        <div className="mt-4">
          <div className="kv"><span>{symbol} bought</span><span>{quote ? formatUnits(quote, 18, 4) : "…"}</span></div>
          <div className="kv"><span>Exposure</span><span>{usd(sizeUsd)}</span></div>
          <div className="kv"><span>Berth loan</span><span>{formatUnits(loan, 6, 2)} USDG</span></div>
          <div className="kv"><span>Liquidated if {symbol} falls to</span><span>{liq ? usd(liq) : "…"}</span></div>
          <div className="kv"><span>Loan rate, a year</span><span>{live ? pct(row?.onixs?.credit?.borrowApr) : "Starts at launch"}</span></div>
          <div className="kv"><span>What the bought stock earns</span><span>{live ? `${pct(row?.onixs?.short?.supplyApr)} rent` : "Rent, at launch"}</span></div>
        </div>
        <label className="mt-5 flex items-start gap-3 text-[13.5px] text-ink-2">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 size-4 accent-amber" />
          I understand leverage multiplies losses, that the position can be liquidated, and that nothing on ONIXS is guaranteed.
        </label>
        <ActionButton
          live={live}
          ready={agree && m > 0n && quote !== null && Boolean(data && m <= data.usdg)}
          label="Open the long"
          state={open}
          testid="lever-go"
          onRun={async () => {
            if (!desk || !address || !quote) return;
            const minOut = (quote * 99n) / 100n;
            const ok = await open.run(
              [
                ...ensureBerth(data?.berth ?? null),
                { kind: "approve", label: "Approve your margin", token: USDG.address, spender: berthAddress(address), amount: m },
                { kind: "call", label: `Open the ${symbol} long`, to: berthAddress(address), data: berthCalls.openLong(desk.id, m, loan, minOut) },
              ],
              `${lev.toFixed(2)}x ${symbol} long opened.`,
            );
            if (ok) {
              setMargin("");
              setTick((t) => t + 1);
            }
          }}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="slab border-l-[3px] !border-l-rose p-5 sm:p-6">
          <h3 className="text-[18px] font-bold">Before you lever up</h3>
          <dl className="mt-3 space-y-3 text-[14px] leading-relaxed">
            <div><dt className="font-semibold">Losses grow with the multiple.</dt><dd className="text-ink-2">At {lev.toFixed(2)}x a 10% drop in {symbol} takes about {(lev * 10).toFixed(0)}% of your margin.</dd></div>
            <div><dt className="font-semibold">Liquidation is possible.</dt><dd className="text-ink-2">At the liquidation price anyone may repay your loan with your posted stock, plus a bonus.</dd></div>
            <div><dt className="font-semibold">Unwinding needs stock on the shelf.</dt><dd className="text-ink-2">Closing redeems the lent stock. If shorts have it all out, repay the loan yourself and take the shares back instead.</dd></div>
            <div><dt className="font-semibold">Rates float.</dt><dd className="text-ink-2">The loan rate and the rent both move with use, every block.</dd></div>
          </dl>
        </div>
        <div className="slab p-5 sm:p-6">
          <h3 className="text-[18px] font-bold">Your {symbol} long</h3>
          {!address ? (
            <p className="mt-2 text-[14px] text-ink-3">Shown once a wallet is connected.</p>
          ) : !pos ? (
            <>
              <p className="mt-2 text-[14px] text-ink-3">No leveraged long open on {symbol}.</p>
              {close.done ? <p className="mt-3 text-[13.5px] text-jade">{close.done}</p> : null}
            </>
          ) : (
            <>
              <div className="mt-3">
                <div className="kv"><span>Stock held</span><span>{formatUnits(sharesToStock(pos.posted, perShare), 18, 4)} {symbol}</span></div>
                <div className="kv"><span>Owed</span><span>{formatUnits(pos.usdgOwed, 6, 2)} USDG</span></div>
              </div>
              <ActionButton
                live={live}
                ready
                label="Close the long"
                state={close}
                onRun={async () => {
                  if (!desk || !address) return;
                  const back = await sellStock(stock.token, sharesToStock(pos.posted, perShare));
                  const minOut = back > pos.usdgOwed ? ((back - pos.usdgOwed) * 97n) / 100n : 0n;
                  const ok = await close.run([{ kind: "call", label: "Close the long", to: berthAddress(address), data: berthCalls.closeLong(desk.id, minOut) }], "Long closed. USDG is back in your wallet.");
                  if (ok) setTick((t) => t + 1);
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
