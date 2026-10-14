"use client";

import { CHARTER } from "@/config/contracts";
import { readAddress } from "@/lib/abi";
import { ethCall } from "@/lib/client";
import { charterCalls } from "@/lib/onixs/calls";
import type { Step } from "@/lib/onixs/runner";

/** The wallet's berth address as the Charter reports it after any opening step has run. */
export const berthAddress = (user: string) => async () => {
  const b = readAddress(await ethCall(CHARTER, charterCalls.berthOf(user)), 0);
  if (/^0x0{40}$/.test(b)) throw new Error("Your berth is not open yet.");
  return b;
};

/** Steps that open a berth first when the wallet has none (one signature, once per wallet). */
export const ensureBerth = (berth: string | null): Step[] => (berth ? [] : [{ kind: "call", label: "Open your berth (once)", to: CHARTER, data: charterCalls.openBerth() }]);
