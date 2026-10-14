"use client";

import { USDG } from "@/config/brand";
import { UNISWAP_V3 } from "@/config/contracts";
import { address as addr, readWord, word } from "@/lib/abi";
import { selector } from "@/lib/calls";
import { ethCall } from "@/lib/client";

/*
 * QuoterV2 reads against the stock's 0.05% Uniswap v3 pool: the same pool every ONIXS one-step trade fills
 * against, so these are the numbers the berth will meet (before anyone else trades first).
 */

const FEE = 500n;
const IN = `0x${selector("quoteExactInputSingle((address,address,uint256,uint24,uint160))")}`;
const OUT = `0x${selector("quoteExactOutputSingle((address,address,uint256,uint24,uint160))")}`;

export async function quoteIn(tokenIn: string, tokenOut: string, amountIn: bigint) {
  if (amountIn <= 0n) return 0n;
  const r = await ethCall(UNISWAP_V3.quoterV2, `${IN}${addr(tokenIn)}${addr(tokenOut)}${word(amountIn)}${word(FEE)}${word(0n)}`);
  return readWord(r, 0);
}

export async function quoteOut(tokenIn: string, tokenOut: string, amountOut: bigint) {
  if (amountOut <= 0n) return 0n;
  const r = await ethCall(UNISWAP_V3.quoterV2, `${OUT}${addr(tokenIn)}${addr(tokenOut)}${word(amountOut)}${word(FEE)}${word(0n)}`);
  return readWord(r, 0);
}

export const sellStock = (stock: string, amount: bigint) => quoteIn(stock, USDG.address, amount);
export const buyStockWith = (stock: string, usdg: bigint) => quoteIn(USDG.address, stock, usdg);
export const costToBuy = (stock: string, amount: bigint) => quoteOut(USDG.address, stock, amount);
