"use client";

import { useEffect, useState } from "react";
import artifacts from "@/lib/onchain/artifacts.json";
import { ActionButton } from "@/components/app/Gate";
import { useWallet } from "@/components/wallet/WalletProvider";
import { USDG, explorerAddress } from "@/config/brand";
import { CHARTER, MORPHO, UNISWAP_V3 } from "@/config/contracts";
import { LISTED, LISTING_PARAMS } from "@/config/stocks";
import { storageKey } from "@/config/storage";
import { simulate, waitReceipt, explain } from "@/lib/client";
import { charterArgs, encodeList, leaseholdArgs, markArgs } from "@/lib/onixs/deploy";
import type { MarketParams } from "@/lib/morpho";

/*
 * Runs the deploy order from referensi/CONTRACTS.txt with the paris bytecode in artifacts.json:
 * Charter, then per stock (SPY, QQQ, NVDA): short mark → leasehold → credit mark → charter.list().
 * Each step is dry-run first; addresses are kept in localStorage until the owner pastes them into
 * src/config/contracts.ts.
 */

type Art = { contracts: Record<string, { bytecode: string }> };
const ART = artifacts as unknown as Art;
const ZERO = "0x0000000000000000000000000000000000000000";
const KEY = storageKey("deploy", "v1");
const e18 = (n: number) => BigInt(Math.round(n * 1000)) * 10n ** 15n;

type Done = { charter?: string; charterBlock?: number; rows: Record<string, { shortMark?: string; leasehold?: string; creditMark?: string; listed?: boolean; block?: number }> };

function steps(d: Done) {
  const out: { key: string; label: string }[] = [{ key: "charter", label: "OnixsCharter (and the berth implementation)" }];
  for (const s of LISTED) out.push({ key: `${s.symbol}:short`, label: `${s.symbol} short mark` }, { key: `${s.symbol}:lease`, label: `${s.symbol} leasehold (creates the short market)` }, { key: `${s.symbol}:credit`, label: `${s.symbol} credit mark` }, { key: `${s.symbol}:list`, label: `List ${s.symbol} (creates the credit market)` });
  const isDone = (k: string) => {
    if (k === "charter") return Boolean(d.charter);
    const [sym, part] = k.split(":");
    const r = d.rows[sym] ?? {};
    return part === "short" ? Boolean(r.shortMark) : part === "lease" ? Boolean(r.leasehold) : part === "credit" ? Boolean(r.creditMark) : Boolean(r.listed);
  };
  return out.map((s) => ({ ...s, done: isDone(s.key) }));
}

export function DeployDesk() {
  const { address, sendTransaction } = useWallet();
  const [d, setD] = useState<Done>({ rows: {} });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      // Restoring saved progress from this browser once, on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setD(JSON.parse(saved));
    } catch {
      // ignore unreadable progress
    }
  }, []);
  const save = (n: Done) => {
    setD(n);
    localStorage.setItem(KEY, JSON.stringify(n));
  };
  const list = steps(d);
  const next = list.find((s) => !s.done) ?? null;

  async function create(data: string) {
    if (!address) throw new Error("Connect the owner wallet.");
    await simulate({ from: address, data });
    const hash = await sendTransaction({ data });
    const r = await waitReceipt(hash, 300_000);
    if (!r.contractAddress) throw new Error("No contract address in the receipt.");
    return { address: r.contractAddress, block: Number(BigInt(r.blockNumber)) };
  }

  async function runNext() {
    if (!next || !address) return;
    setBusy(next.label);
    setError(null);
    try {
      const n: Done = JSON.parse(JSON.stringify(d));
      if (next.key === "charter") {
        const r = await create(ART.contracts.OnixsCharter.bytecode + charterArgs(address, MORPHO.blue, USDG.address, UNISWAP_V3.factory));
        n.charter = r.address;
        n.charterBlock = r.block;
      } else {
        const [sym, part] = next.key.split(":");
        const s = LISTED.find((x) => x.symbol === sym)!;
        const p = LISTING_PARAMS[sym];
        const row = (n.rows[sym] ??= {});
        const short: MarketParams = { loanToken: s.token, collateralToken: USDG.address, oracle: row.shortMark ?? ZERO, irm: MORPHO.adaptiveIrm, lltv: e18(p.shortLltv) };
        if (part === "short") {
          const r = await create(ART.contracts.OnixsMark.bytecode + markArgs(s.feed, s.token, USDG.feed, USDG.address, ZERO));
          row.shortMark = r.address;
          row.block = r.block;
        } else if (part === "lease") {
          const r = await create(ART.contracts.OnixsLeasehold.bytecode + leaseholdArgs(s.token, MORPHO.blue, short, `ONIXS Leasehold ${sym}`, `on${sym}`));
          row.leasehold = r.address;
        } else if (part === "credit") {
          const r = await create(ART.contracts.OnixsMark.bytecode + markArgs(s.feed, s.token, USDG.feed, USDG.address, row.leasehold!));
          row.creditMark = r.address;
        } else {
          const data = encodeList({
            stock: s.token,
            feed: s.feed,
            pool: s.pool!,
            leasehold: row.leasehold!,
            short,
            credit: { loanToken: USDG.address, collateralToken: row.leasehold!, oracle: row.creditMark!, irm: MORPHO.adaptiveIrm, lltv: e18(p.creditLltv) },
            maxLeverageBps: Math.round(p.maxLeverage * 10_000),
            shortOpenLtvBps: Math.round(p.shortOpenLtv * 10_000),
            maxSlipBps: Math.round(p.maxSlip * 10_000),
            maxFeedAge: p.maxFeedAgeH * 3600,
            paused: false,
          });
          await simulate({ from: address, to: n.charter!, data });
          const hash = await sendTransaction({ to: n.charter!, data });
          await waitReceipt(hash, 300_000);
          row.listed = true;
        }
      }
      save(n);
    } catch (e) {
      setError(explain(e, "The step failed. Nothing was saved; try again."));
    } finally {
      setBusy(null);
    }
  }

  const snippet = d.charter
    ? `export const CHARTER = "${d.charter}";\nexport const CHARTER_BLOCK = ${d.charterBlock ?? 0};\n\nexport const LISTINGS: { symbol: "SPY" | "QQQ" | "NVDA"; shortMark: string; leasehold: string; creditMark: string; block: number }[] = [\n${LISTED.filter((s) => d.rows[s.symbol]?.listed)
        .map((s) => `  { symbol: "${s.symbol}", shortMark: "${d.rows[s.symbol].shortMark}", leasehold: "${d.rows[s.symbol].leasehold}", creditMark: "${d.rows[s.symbol].creditMark}", block: ${d.rows[s.symbol].block ?? 0} },`)
        .join("\n")}\n];`
    : null;

  return (
    <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="slab p-5 sm:p-6" data-testid="deploy-steps">
        <h2 className="text-[20px] font-bold">Steps</h2>
        {CHARTER ? <p className="mt-2 text-[13.5px] text-amber">src/config/contracts.ts already names a Charter: {CHARTER}. Deploying again makes a second set.</p> : null}
        <ol className="mt-3">
          {list.map((s, i) => (
            <li key={s.key} className="kv text-[14px]">
              <span>
                {i + 1}. {s.label}
              </span>
              <span className={s.done ? "text-jade" : s === next ? "text-amber" : "text-ink-3"}>{s.done ? "done" : s === next ? "next" : "waiting"}</span>
            </li>
          ))}
        </ol>
        <ActionButton live ready={Boolean(next)} label={next ? `Send: ${next.label}` : "All steps done"} state={{ busy: Boolean(busy), step: busy ? `Sending: ${busy}` : null, error, done: null, hash: null }} onRun={runNext} testid="deploy-next" />
        <button type="button" className="btn btn-sm btn-line mt-4" onClick={() => confirm("Forget the saved progress in this browser?") && save({ rows: {} })}>
          Forget saved progress
        </button>
      </div>
      <div className="slab min-w-0 p-5 sm:p-6">
        <h2 className="text-[20px] font-bold">Addresses</h2>
        <ul className="mt-3 text-[13.5px]">
          {d.charter ? <li className="kv"><span>Charter</span><a className="font-mono" href={explorerAddress(d.charter)} target="_blank" rel="noreferrer">{d.charter}</a></li> : null}
          {LISTED.flatMap((s) =>
            (["shortMark", "leasehold", "creditMark"] as const).filter((k) => d.rows[s.symbol]?.[k]).map((k) => (
              <li key={s.symbol + k} className="kv">
                <span>{s.symbol} {k}</span>
                <a className="truncate font-mono" href={explorerAddress(d.rows[s.symbol][k]!)} target="_blank" rel="noreferrer">{d.rows[s.symbol][k]}</a>
              </li>
            )),
          )}
        </ul>
        {snippet ? (
          <>
            <h3 className="mt-5 text-[15px] font-semibold">Paste into src/config/contracts.ts</h3>
            <pre className="scroll-x mt-2 rounded-lg bg-night-2 p-3 font-mono text-[12px] text-ink-2">{snippet}</pre>
            <p className="mt-3 text-[12.5px] text-ink-3">Then: npm run verify-deployment -- --owner {address ?? "<owner>"}, node ../referensi/tools/make-explorer-kit.mjs, the Blockscout tool, and delete this page.</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
