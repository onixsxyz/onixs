"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@/components/wallet/WalletProvider";
import { encodeAllowance, encodeApprove, wordAt } from "@/lib/calls";
import { ethCall, explain, simulate, waitReceipt } from "@/lib/client";

/*
 * Runs a list of steps one signature at a time. An approval step is skipped when the allowance already
 * covers it and always approves the exact amount; every other step is dry-run with eth_call first, so a
 * refusal is explained in words before the wallet opens.
 */

type Lazy<T> = T | (() => Promise<T>);
/** Amounts and calldata may be computed when the step runs, from what the previous step left on chain. */
export type Step =
  | { kind: "approve"; label: string; token: string; spender: Lazy<string>; amount: Lazy<bigint> }
  | { kind: "call"; label: string; to: Lazy<string>; data: Lazy<string> };

const resolve = async <T,>(v: Lazy<T>): Promise<T> => (typeof v === "function" ? await (v as () => Promise<T>)() : v);

export type RunState = { busy: boolean; step: string | null; error: string | null; done: string | null; hash: string | null };

export function useRunner() {
  const { address, sendTransaction, onRobinhoodChain, switchNetwork } = useWallet();
  const [state, setState] = useState<RunState>({ busy: false, step: null, error: null, done: null, hash: null });

  const run = useCallback(
    async (steps: Step[], doneText: string) => {
      if (!address) return false;
      setState({ busy: true, step: null, error: null, done: null, hash: null });
      try {
        if (!onRobinhoodChain) await switchNetwork();
        let last: string | null = null;
        for (const st of steps) {
          if (st.kind === "approve") {
            const spender = await resolve(st.spender);
            const amount = await resolve(st.amount);
            if (amount <= 0n) continue;
            const current = wordAt(await ethCall(st.token, encodeAllowance(address, spender)), 0);
            if (current >= amount) continue;
            setState((s) => ({ ...s, step: st.label }));
            const hash = await sendTransaction({ to: st.token, data: encodeApprove(spender, amount) });
            await waitReceipt(hash);
            last = hash;
          } else {
            const to = await resolve(st.to);
            const data = await resolve(st.data);
            setState((s) => ({ ...s, step: `Checking: ${st.label}` }));
            await simulate({ from: address, to, data });
            setState((s) => ({ ...s, step: st.label }));
            const hash = await sendTransaction({ to, data });
            await waitReceipt(hash);
            last = hash;
          }
        }
        setState({ busy: false, step: null, error: null, done: doneText, hash: last });
        return true;
      } catch (error) {
        setState({ busy: false, step: null, error: explain(error), done: null, hash: null });
        return false;
      }
    },
    [address, sendTransaction, onRobinhoodChain, switchNetwork],
  );

  return { ...state, run, reset: () => setState({ busy: false, step: null, error: null, done: null, hash: null }) };
}
