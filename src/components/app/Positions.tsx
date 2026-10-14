"use client";

import Link from "next/link";
import { useBoard, rowOf } from "@/components/BoardProvider";
import { usd } from "@/components/ui/Live";
import { ConnectEmpty } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { charterLive } from "@/config/contracts";
import { explorerAddress, explorerTx, shortAddress } from "@/config/brand";
import { formatUnits } from "@/lib/client";
import { useCharterEvents } from "@/lib/onixs/events";
import { sharesToStock, usePortfolio } from "@/lib/onixs/portfolio";
import { LISTED } from "@/config/stocks";

export function Positions() {
  const { address } = useWallet();
  const { data, error } = usePortfolio(address);
  const { board } = useBoard();
  const { events } = useCharterEvents(address ?? undefined);
  if (!address) return <div className="slab p-6"><ConnectEmpty>Link a wallet and this tab lists its tokens, its loans in both directions, its shorts and longs, and the berth that holds them.</ConnectEmpty></div>;
  return (
    <>
      {error ? <p className="mb-4 text-[13.5px] text-fall">{error}</p> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="slab p-5">
          <span className="tag">USDG in wallet</span>
          <b className="mt-2 block text-[24px] font-bold">{data ? formatUnits(data.usdg, 6, 2) : "…"}</b>
        </div>
        <div className="slab p-5">
          <span className="tag">Your berth</span>
          <b className="mt-2 block font-mono text-[16px]">{!charterLive() ? "At launch" : data?.berth ? <a className="hover:text-amber" href={explorerAddress(data.berth)} target="_blank" rel="noreferrer">{shortAddress(data.berth)}</a> : "Not opened yet"}</b>
          <span className="mt-1 block text-[12.5px] text-ink-3">Opened by your first short, long or pair.</span>
        </div>
        <div className="slab p-5">
          <span className="tag">Stock tokens in wallet</span>
          <span className="mt-2 block text-[14px]">{data ? LISTED.map((s) => `${formatUnits(data.stocks[s.symbol] ?? 0n, 18, 3)} ${s.symbol}`).join(" · ") : "…"}</span>
        </div>
      </div>
      <div className="scroll-x mt-6 rounded-[14px] border border-line">
        <table className="w-full min-w-[820px] text-[14px]" data-testid="positions-table">
          <thead className="bg-night-2 text-left text-[12.5px] text-ink-3">
            <tr>
              <th className="px-4 py-3 font-semibold">Stock</th>
              <th className="px-3 py-3 text-right font-semibold">Lent</th>
              <th className="px-3 py-3 text-right font-semibold">USDG lent</th>
              <th className="px-3 py-3 text-right font-semibold">Posted · owed</th>
              <th className="px-3 py-3 text-right font-semibold">Short</th>
              <th className="px-4 py-3 text-right font-semibold">Leveraged long</th>
            </tr>
          </thead>
          <tbody>
            {!charterLive() ? (
              <tr className="border-t border-line bg-slab">
                <td colSpan={6} className="px-4 py-5 text-ink-3">
                  The ONIXS markets open at launch. Your positions will show here, read from Morpho and your berth.
                </td>
              </tr>
            ) : (
              (data?.desks ?? []).map((d) => {
                const price = rowOf(board, d.symbol)?.tokenUsd ?? 0;
                return (
                  <tr key={d.symbol} className="border-t border-line bg-slab">
                    <td className="px-4 py-3"><span className="ticker">{d.symbol}</span></td>
                    <td className="px-3 py-3 text-right">{formatUnits(d.sharesInStock, 18, 4)} <span className="text-ink-3">({usd((Number(d.sharesInStock) / 1e18) * price)})</span></td>
                    <td className="px-3 py-3 text-right">{d.mine ? formatUnits(d.mine.usdgLent, 6, 2) : "0"}</td>
                    <td className="px-3 py-3 text-right">{d.mine ? `${formatUnits(sharesToStock(d.mine.posted, d.perShare), 18, 4)} · ${formatUnits(d.mine.usdgOwed, 6, 2)} USDG` : "0"}</td>
                    <td className="px-3 py-3 text-right">{d.berthShort ? `${formatUnits(d.berthShort.stockOwed, 18, 4)} owed` : "None"}</td>
                    <td className="px-4 py-3 text-right">{d.berthLong ? `${formatUnits(sharesToStock(d.berthLong.posted, d.perShare), 18, 4)} held` : "None"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link className="btn btn-sm btn-line" href="/app/lend">Lend</Link>
        <Link className="btn btn-sm btn-line" href="/app/borrow">Borrow</Link>
        <Link className="btn btn-sm btn-line" href="/app/short">Short</Link>
        <Link className="btn btn-sm btn-line" href="/app/pairs">Pairs</Link>
      </div>
      <h2 className="mt-10 text-[20px] font-bold">Your recent activity</h2>
      {events.length ? (
        <ol className="mt-2">
          {events.map((e) => (
            <li key={e.tx + e.kind} className="kv">
              <span><span className="ticker mr-2">{e.symbol}</span>{e.label}</span>
              <a href={explorerTx(e.tx)} target="_blank" rel="noreferrer" className="text-ink-2 hover:text-amber">block {e.block.toLocaleString("en-US")}</a>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-[14px] text-ink-3">Nothing in recent blocks.</p>
      )}
      <div className="slab mt-10 p-5 sm:p-6">
        <h2 className="text-[18px] font-bold">Leaving without this site</h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">
          Everything here is on chain. Lent stock: call <code className="font-mono text-[13px]">redeem</code> on the stock&apos;s leasehold. USDG lent,
          shares posted, USDG borrowed: call Morpho Blue directly, the positions are in your wallet&apos;s name. Shorts and longs: your berth&apos;s
          <code className="font-mono text-[13px]"> closeShort</code>, <code className="font-mono text-[13px]">closeLong</code>, or <code className="font-mono text-[13px]">ownerCall</code> to talk to Morpho yourself. Addresses are on the Verify tab.
        </p>
      </div>
    </>
  );
}
