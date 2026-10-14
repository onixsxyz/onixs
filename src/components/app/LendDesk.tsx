"use client";

import { useState } from "react";
import { StockPicker } from "@/components/app/StockPicker";
import { AmountField, ActionButton } from "@/components/app/Gate";
import { usePick } from "@/components/app/usePick";
import { useBoard, rowOf } from "@/components/BoardProvider";
import { pct, usd } from "@/components/ui/Live";
import { useWallet } from "@/components/wallet/WalletProvider";
import { USDG } from "@/config/brand";
import { MORPHO, charterLive } from "@/config/contracts";
import { LISTED, findListed } from "@/config/stocks";
import { formatUnits, parseUnits } from "@/lib/client";
import { encodeSupply, encodeWithdraw } from "@/lib/morpho";
import { leaseholdCalls } from "@/lib/onixs/calls";
import { deskOf } from "@/lib/onixs/markets";
import { usePortfolio } from "@/lib/onixs/portfolio";
import { useRunner } from "@/lib/onixs/runner";

const USDG_CARD = { symbol: "USDG", name: "Lend dollars", logo: "/stocks/usdg.webp" };

export function LendDesk() {
  const [pick, setPick] = usePick("NVDA", ["USDG", ...LISTED.map((s) => s.symbol)]);
  const [credit, setCredit] = useState("SPY");
  const { board } = useBoard();
  return (
    <>
      <StockPicker
        value={pick}
        onChange={setPick}
        extra={[USDG_CARD]}
        note={(s) => {
          if (!board?.live) return null;
          if (s === "USDG") return null;
          const r = rowOf(board, s)?.onixs?.short?.supplyApr;
          return r === null || r === undefined ? null : `${(r * 100).toFixed(2)}% rent`;
        }}
      />
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {pick === "USDG" ? <UsdgLend credit={credit} setCredit={setCredit} /> : <StockLend symbol={pick} />}
      </div>
    </>
  );
}

function StockLend({ symbol }: { symbol: string }) {
  const stock = findListed(symbol)!;
  const desk = deskOf(symbol);
  const live = charterLive() && Boolean(desk);
  const { address } = useWallet();
  const [tick, setTick] = useState(0);
  const { data } = usePortfolio(address, tick);
  const { board } = useBoard();
  const row = rowOf(board, symbol);
  const pos = data?.desks.find((d) => d.symbol === symbol) ?? null;
  const [amount, setAmount] = useState("");
  const [out, setOut] = useState("");
  const lend = useRunner();
  const take = useRunner();
  const raw = parseUnits(amount, 18);
  const rawOut = parseUnits(out, 18);
  const bal = data?.stocks[symbol] ?? null;
  const sh = row?.onixs?.short;

  return (
    <>
      <div className="slab min-w-0 p-5 sm:p-6" data-testid="lend-panel">
        <h2 className="text-[22px] font-bold">Lend {symbol}</h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">
          Your {symbol} goes into the {symbol} leasehold, which supplies all of it to one Morpho market. Shorts borrow from that market and the
          interest they pay grows every lender&apos;s share.
        </p>
        <AmountField label={`${symbol} to lend`} unit={symbol} value={amount} onChange={setAmount} hint={address ? `Wallet: ${bal === null ? "…" : formatUnits(bal, 18, 4)}` : "No wallet yet"} onMax={bal ? () => setAmount(formatUnits(bal, 18, 18).replace(/,/g, "")) : undefined} testid="lend-amount" />
        <div className="mt-4">
          <div className="kv"><span>Worth now</span><span>{raw && row?.tokenUsd ? usd((Number(raw) / 1e18) * row.tokenUsd) : "…"}</span></div>
          <div className="kv"><span>Rent, a year (floats)</span><span>{live ? pct(sh?.supplyApr) : "Starts at launch"}</span></div>
          <div className="kv"><span>Out on loan now</span><span>{live ? pct(sh?.util, 1) : "…"}</span></div>
          <div className="kv"><span>ONIXS fee</span><span>None</span></div>
          <div className="kv"><span>$ONIXS on top</span><span className="text-ink-3">Later</span></div>
        </div>
        <ActionButton
          live={live}
          ready={Boolean(raw && raw > 0n && bal !== null && raw <= bal)}
          label={`Lend ${symbol}`}
          state={lend}
          testid="lend-go"
          onRun={async () => {
            if (!desk || !raw || !address) return;
            const ok = await lend.run(
              [
                { kind: "approve", label: `Approve ${symbol}`, token: stock.token, spender: desk.leasehold, amount: raw },
                { kind: "call", label: `Lend ${symbol}`, to: desk.leasehold, data: leaseholdCalls.deposit(raw, address) },
              ],
              `${amount} ${symbol} lent.`,
            );
            if (ok) {
              setAmount("");
              setTick((t) => t + 1);
            }
          }}
        />
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">The first time asks for two signatures: approve the exact amount, then lend. Lenders absorb a short&apos;s bad debt if a stock jumps faster than it can be liquidated.</p>
      </div>

      <div className="slab min-w-0 p-5 sm:p-6" data-testid="lend-mine">
        <h2 className="text-[22px] font-bold">Your lent {symbol}</h2>
        <div className="mt-4">
          <div className="kv"><span>Leasehold shares</span><span>{address ? (pos ? formatUnits(pos.shares, 24, 4) : live ? "…" : "None yet") : "No wallet yet"}</span></div>
          <div className="kv"><span>Worth in {symbol}</span><span>{pos ? formatUnits(pos.sharesInStock, 18, 6) : "…"}</span></div>
          <div className="kv"><span>Worth in dollars</span><span>{pos && row?.tokenUsd ? usd((Number(pos.sharesInStock) / 1e18) * row.tokenUsd) : "…"}</span></div>
          <div className="kv"><span>{symbol} on the shelf to withdraw</span><span>{pos ? formatUnits(pos.available, 18, 4) : "…"}</span></div>
        </div>
        <AmountField label="Shares to withdraw" unit="shares" value={out} onChange={setOut} onMax={pos?.shares ? () => setOut(formatUnits(pos.shares, 24, 24).replace(/,/g, "")) : undefined} testid="lend-out" />
        <ActionButton
          live={live}
          ready={Boolean(rawOut && pos && parseUnits(out, 24)! > 0n && parseUnits(out, 24)! <= pos.shares)}
          label="Withdraw"
          state={take}
          onRun={async () => {
            const sh24 = parseUnits(out, 24);
            if (!desk || !sh24 || !address) return;
            const ok = await take.run([{ kind: "call", label: "Withdraw", to: desk.leasehold, data: leaseholdCalls.redeem(sh24, address, address) }], `Withdrawn to your wallet.`);
            if (ok) {
              setOut("");
              setTick((t) => t + 1);
            }
          }}
        />
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">If shorts have most of the {symbol} out on loan, withdrawals wait for returns; the rate climbs steeply near full use to bring them back.</p>
      </div>
    </>
  );
}

function UsdgLend({ credit, setCredit }: { credit: string; setCredit: (s: string) => void }) {
  const desk = deskOf(credit);
  const live = charterLive() && Boolean(desk);
  const { address } = useWallet();
  const [tick, setTick] = useState(0);
  const { data } = usePortfolio(address, tick);
  const { board } = useBoard();
  const cr = rowOf(board, credit)?.onixs?.credit;
  const pos = data?.desks.find((d) => d.symbol === credit) ?? null;
  const [amount, setAmount] = useState("");
  const raw = parseUnits(amount, 6);
  const lend = useRunner();
  const take = useRunner();
  return (
    <>
      <div id="usdg" className="slab min-w-0 scroll-mt-32 p-5 sm:p-6" data-testid="usdg-panel">
        <h2 className="text-[22px] font-bold">Lend USDG</h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">
          USDG goes straight into a Morpho market in your own name, where stock lenders borrow dollars against their leasehold shares. Pick
          whose borrowers you fund:
        </p>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Which stock's borrowers">
          {LISTED.map((s) => (
            <button key={s.symbol} type="button" role="radio" aria-checked={credit === s.symbol} onClick={() => setCredit(s.symbol)} className={`chip !h-8 !px-3 ${credit === s.symbol ? "!border-amber text-ink" : ""}`}>
              against {s.symbol}
            </button>
          ))}
        </div>
        <AmountField label="USDG to lend" unit="USDG" value={amount} onChange={setAmount} hint={address ? `Wallet: ${data ? formatUnits(data.usdg, 6, 2) : "…"}` : "No wallet yet"} onMax={data?.usdg ? () => setAmount(formatUnits(data.usdg, 6, 6).replace(/,/g, "")) : undefined} testid="usdg-amount" />
        <div className="mt-4">
          <div className="kv"><span>Interest, a year (floats)</span><span>{live ? pct(cr?.supplyApr) : "Starts at launch"}</span></div>
          <div className="kv"><span>Borrowers&apos; limit</span><span>62.5% of posted stock</span></div>
          <div className="kv"><span>Lent in this market</span><span>{live && cr ? usd(cr.supply, 0) : "…"}</span></div>
        </div>
        <ActionButton
          live={live}
          ready={Boolean(raw && raw > 0n && data && raw <= data.usdg)}
          label="Lend USDG"
          state={lend}
          onRun={async () => {
            if (!desk || !raw || !address) return;
            const ok = await lend.run(
              [
                { kind: "approve", label: "Approve USDG", token: USDG.address, spender: MORPHO.blue, amount: raw },
                { kind: "call", label: "Lend USDG", to: MORPHO.blue, data: encodeSupply(desk.credit, raw, 0n, address) },
              ],
              `${amount} USDG lent against ${credit}.`,
            );
            if (ok) {
              setAmount("");
              setTick((t) => t + 1);
            }
          }}
        />
      </div>
      <div className="slab min-w-0 p-5 sm:p-6">
        <h2 className="text-[22px] font-bold">Your USDG against {credit}</h2>
        <div className="mt-4">
          <div className="kv"><span>Lent, with interest</span><span>{address ? (pos?.mine ? `${formatUnits(pos.mine.usdgLent, 6, 2)} USDG` : live ? "…" : "None yet") : "No wallet yet"}</span></div>
          <div className="kv"><span>Free to withdraw in the market</span><span>{cr ? usd(Math.max(0, cr.supply - cr.borrowed), 0) : "…"}</span></div>
        </div>
        <ActionButton
          live={live}
          ready={Boolean(pos?.mine && pos.mine.raw.supplyShares > 0n)}
          label="Withdraw all of it"
          state={take}
          onRun={async () => {
            if (!desk || !address || !pos?.mine) return;
            const ok = await take.run([{ kind: "call", label: "Withdraw USDG", to: MORPHO.blue, data: encodeWithdraw(desk.credit, 0n, pos.mine.raw.supplyShares, address, address) }], "USDG back in your wallet.");
            if (ok) setTick((t) => t + 1);
          }}
        />
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">Withdrawing by shares takes everything, interest included, with no dust left behind. If borrowers are using the market&apos;s USDG, you wait for repayments.</p>
      </div>
    </>
  );
}
