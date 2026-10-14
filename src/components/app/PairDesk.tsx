"use client";

import { useState } from "react";
import { AmountField, ActionButton } from "@/components/app/Gate";
import { useQuote } from "@/components/app/ShortDesk";
import { useBoard, rowOf } from "@/components/BoardProvider";
import { usd } from "@/components/ui/Live";
import { useWallet } from "@/components/wallet/WalletProvider";
import { USDG } from "@/config/brand";
import { charterLive } from "@/config/contracts";
import { LISTED, LISTING_PARAMS, findListed } from "@/config/stocks";
import { formatUnits, parseUnits } from "@/lib/client";
import { berthCalls } from "@/lib/onixs/calls";
import { berthAddress, ensureBerth } from "@/lib/onixs/berth";
import { deskOf } from "@/lib/onixs/markets";
import { sharesToStock, usePortfolio } from "@/lib/onixs/portfolio";
import { buyStockWith, costToBuy, sellStock } from "@/lib/onixs/quote";
import { useRunner } from "@/lib/onixs/runner";

const n = (v: bigint, d: number) => Number(v) / 10 ** d;

function Leg({ side, value, onChange, other }: { side: "Long" | "Short"; value: string; onChange: (s: string) => void; other: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`${side} leg`}>
      {LISTED.map((s) => (
        <button key={s.symbol} type="button" role="radio" aria-checked={value === s.symbol} disabled={s.symbol === other} onClick={() => onChange(s.symbol)} className={`chip !h-9 !px-3.5 text-[13.5px] disabled:opacity-35 ${value === s.symbol ? (side === "Long" ? "!border-jade text-jade" : "!border-rose text-rose") : ""}`}>
          {side} {s.symbol}
        </button>
      ))}
    </div>
  );
}

/**
 * A pair is one leveraged long and one short opened by a single berth call. The short is sized to the same
 * dollar exposure as the long, so the pair bets on the spread between the two stocks, not on the market.
 */
export function PairDesk() {
  const [longS, setLong] = useState("NVDA");
  const [shortS, setShort] = useState("QQQ");
  const { board } = useBoard();
  const { address } = useWallet();
  const [tick, setTick] = useState(0);
  const { data } = usePortfolio(address, tick);
  const [margin, setMargin] = useState("");
  const [lev, setLev] = useState(1.3);
  const L = findListed(longS)!;
  const S = findListed(shortS)!;
  const dl = deskOf(longS);
  const ds = deskOf(shortS);
  const live = charterLive() && Boolean(dl && ds);
  const pS = LISTING_PARAMS[shortS];
  const priceS = rowOf(board, shortS)?.tokenUsd ?? null;
  const m = parseUnits(margin, 6) ?? 0n;
  const loan = (m * BigInt(Math.round((lev - 1) * 1000))) / 1000n;
  const longOut = useQuote((a) => buyStockWith(L.token, a), m + loan, L.token);
  const exposure = n(m + loan, 6);
  const shortSize = priceS && exposure > 0 ? BigInt(Math.floor((exposure / priceS) * 1e6)) * 10n ** 12n : 0n;
  const proceeds = useQuote((a) => sellStock(S.token, a), shortSize, S.token);
  // Margin for the short leg: enough that the opening use sits at 85% of the opening limit.
  const target = pS.shortOpenLtv * 0.85;
  const shortMarginUsd = proceeds ? Math.max(0, n(proceeds, 6) * ((1 - target) / target)) : null;
  const shortMargin = shortMarginUsd !== null ? BigInt(Math.ceil(shortMarginUsd * 1e6)) : 0n;
  const total = m + shortMargin;
  const pos = data?.desks;
  const lp = pos?.find((d) => d.symbol === longS);
  const sp = pos?.find((d) => d.symbol === shortS);
  const open = useRunner();
  const close = useRunner();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr]">
      <div className="slab min-w-0 p-5 sm:p-6" data-testid="pair-panel">
        <h2 className="text-[22px] font-bold">Build a pair</h2>
        <div className="mt-4 space-y-3">
          <Leg side="Long" value={longS} onChange={setLong} other={shortS} />
          <Leg side="Short" value={shortS} onChange={setShort} other={longS} />
        </div>
        <AmountField label={`Margin for the ${longS} long`} unit="USDG" value={margin} onChange={setMargin} hint={address ? `Wallet: ${data ? formatUnits(data.usdg, 6, 2) : "…"}` : "No wallet yet"} testid="pair-margin" />
        <label className="mt-5 block">
          <span className="flex justify-between text-[13.5px]">
            <span className="font-semibold">Long leverage {lev.toFixed(2)}x</span>
            <span className="text-ink-3">1.1x to {LISTING_PARAMS[longS].maxLeverage}x</span>
          </span>
          <input type="range" min={1.1} max={LISTING_PARAMS[longS].maxLeverage} step={0.05} value={lev} onChange={(e) => setLev(Number(e.target.value))} className="mt-3 w-full accent-amber" aria-label="Long leverage" />
        </label>
        <div className="mt-4">
          <div className="kv"><span>Long leg</span><span className="text-jade">{longOut ? `${formatUnits(longOut, 18, 4)} ${longS}` : "…"} · {usd(exposure || null)}</span></div>
          <div className="kv"><span>Short leg, same dollars</span><span className="text-rose">{shortSize > 0n ? `${formatUnits(shortSize, 18, 4)} ${shortS}` : "…"}</span></div>
          <div className="kv"><span>Short margin needed</span><span>{shortMarginUsd !== null ? usd(shortMarginUsd) : "…"}</span></div>
          <div className="kv font-semibold"><span className="!text-ink">Total USDG from your wallet</span><span>{total > 0n ? `${formatUnits(total, 6, 2)} USDG` : "…"}</span></div>
        </div>
        <ActionButton
          live={live}
          ready={m > 0n && Boolean(longOut && proceeds) && Boolean(data && total <= data.usdg)}
          label="Open both legs"
          state={open}
          testid="pair-go"
          onRun={async () => {
            if (!dl || !ds || !address || !longOut || !proceeds) return;
            const ok = await open.run(
              [
                ...ensureBerth(data?.berth ?? null),
                { kind: "approve", label: "Approve both margins", token: USDG.address, spender: berthAddress(address), amount: total },
                {
                  kind: "call",
                  label: `Long ${longS}, short ${shortS}`,
                  to: berthAddress(address),
                  data: berthCalls.openPair({ longId: dl.id, longMargin: m, loan, minStockOut: (longOut * 99n) / 100n, shortId: ds.id, shortMargin, stockAmount: shortSize, minUsdgOut: (proceeds * 99n) / 100n }),
                },
              ],
              `Pair opened: long ${longS}, short ${shortS}.`,
            );
            if (ok) {
              setMargin("");
              setTick((t) => t + 1);
            }
          }}
        />
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">Each leg stands alone on Morpho with its own liquidation line: if one leg is liquidated, the other stays open.</p>
      </div>
      <div className="slab min-w-0 p-5 sm:p-6">
        <h2 className="text-[22px] font-bold">Your pair</h2>
        {!address ? (
          <p className="mt-2 text-[14px] text-ink-3">Shown once a wallet is connected.</p>
        ) : !lp?.berthLong || !sp?.berthShort ? (
          <>
            <p className="mt-2 text-[14px] text-ink-3">No open pair of long {longS} and short {shortS}. Single legs show on the Borrow and Short tabs.</p>
            {close.done ? <p className="mt-3 text-[13.5px] text-jade">{close.done}</p> : null}
          </>
        ) : (
          <>
            <div className="mt-3">
              <div className="kv"><span>Long {longS} held</span><span>{formatUnits(sharesToStock(lp.berthLong.posted, lp.perShare), 18, 4)}</span></div>
              <div className="kv"><span>Long loan owed</span><span>{formatUnits(lp.berthLong.usdgOwed, 6, 2)} USDG</span></div>
              <div className="kv"><span>Short {shortS} owed</span><span>{formatUnits(sp.berthShort.stockOwed, 18, 4)}</span></div>
              <div className="kv"><span>Held against the short</span><span>{formatUnits(sp.berthShort.usdgHeld, 6, 2)} USDG</span></div>
            </div>
            <ActionButton
              live={live}
              ready
              label="Close both legs"
              state={close}
              onRun={async () => {
                if (!dl || !ds || !address || !lp.berthLong || !sp.berthShort) return;
                const back = await sellStock(L.token, sharesToStock(lp.berthLong.posted, lp.perShare));
                const minOut = back > lp.berthLong.usdgOwed ? ((back - lp.berthLong.usdgOwed) * 97n) / 100n : 0n;
                const cost = await costToBuy(S.token, sp.berthShort.stockOwed + sp.berthShort.stockOwed / 5000n + 1n);
                const maxIn = (cost * 102n) / 100n;
                const gap = maxIn > sp.berthShort.usdgHeld ? maxIn - sp.berthShort.usdgHeld : 0n;
                const ok = await close.run(
                  [
                    { kind: "approve", label: "Approve the shortfall", token: USDG.address, spender: berthAddress(address), amount: gap },
                    { kind: "call", label: "Close the pair", to: berthAddress(address), data: berthCalls.closePair(dl.id, ds.id, maxIn, minOut) },
                  ],
                  "Pair closed.",
                );
                if (ok) setTick((t) => t + 1);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
