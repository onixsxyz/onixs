"use client";

import { useWallet } from "@/components/wallet/WalletProvider";
import { useWalletModal } from "@/components/wallet/WalletButton";
import type { RunState } from "@/lib/onixs/runner";
import { explorerTx } from "@/config/brand";

/**
 * The action button of every panel. Not deployed → "Opens at launch". No wallet → opens the site dialog.
 * Wrong network → switch. Otherwise the panel's own action, with the runner's progress and outcome.
 */
export function ActionButton({ live, ready, label, onRun, state, testid }: { live: boolean; ready: boolean; label: string; onRun: () => void; state: RunState; testid?: string }) {
  const { address, onRobinhoodChain, chainId, switchNetwork, switching } = useWallet();
  const { open } = useWalletModal();
  let button: React.ReactNode;
  if (!live) button = <button type="button" className="btn" disabled data-testid={testid}>Opens at launch</button>;
  else if (!address) button = <button type="button" className="btn" onClick={open} data-testid={testid}>Connect wallet</button>;
  else if (chainId !== null && !onRobinhoodChain) button = <button type="button" className="btn" onClick={switchNetwork} disabled={switching} data-testid={testid}>{switching ? "Confirm in wallet…" : "Switch to Robinhood Chain"}</button>;
  else button = <button type="button" className="btn" onClick={onRun} disabled={!ready || state.busy} data-testid={testid}>{state.busy ? state.step ?? "Working…" : label}</button>;
  return (
    <div className="mt-5">
      {button}
      {state.error ? <p role="alert" className="mt-3 text-[13.5px] text-fall">{state.error}</p> : null}
      {state.done ? (
        <p className="mt-3 text-[13.5px] text-jade">
          {state.done}{" "}
          {state.hash ? (
            <a className="link" href={explorerTx(state.hash)} target="_blank" rel="noreferrer">
              View transaction
            </a>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

export function AmountField({ label, value, onChange, unit, hint, onMax, testid }: { label: string; value: string; onChange: (v: string) => void; unit: string; hint?: React.ReactNode; onMax?: () => void; testid?: string }) {
  return (
    <label className="mt-5 block">
      <span className="flex items-baseline justify-between gap-3 text-[13.5px]">
        <span className="font-semibold">{label}</span>
        <span className="flex items-center gap-2 text-ink-3">
          {hint}
          {onMax ? (
            <button type="button" className="link text-[12.5px]" onClick={onMax}>
              Max
            </button>
          ) : null}
        </span>
      </span>
      <span className="relative mt-2 block">
        <input inputMode="decimal" placeholder="0.00" value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))} className="field pr-20" data-testid={testid} />
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[13px] font-semibold text-ink-3">{unit}</span>
      </span>
    </label>
  );
}
