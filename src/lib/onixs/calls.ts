import { address as addr, word } from "@/lib/abi";
import { selector } from "@/lib/calls";

/*
 * Calldata for the ONIXS contracts (src/config/contracts.ts has the addresses). Selectors come from the
 * Solidity signatures; scripts and the contract-call test check them against the compiled ABI.
 */

const s = (sig: string) => `0x${selector(sig)}`;
const w = (...v: bigint[]) => v.map(word).join("");

export const SIG = {
  openBerth: "openBerth()",
  berthOf: "berthOf(address)",
  predictBerth: "predictBerth(address)",
  getListing: "getListing(uint256)",
  deposit: "deposit(uint256,address)",
  redeem: "redeem(uint256,address,address)",
  convertToAssets: "convertToAssets(uint256)",
  maxRedeem: "maxRedeem(address)",
  available: "available()",
  totalAssets: "totalAssets()",
  openShort: "openShort(uint256,uint256,uint256,uint256)",
  closeShort: "closeShort(uint256,uint256)",
  openLong: "openLong(uint256,uint256,uint256,uint256)",
  closeLong: "closeLong(uint256,uint256)",
  openPair: "openPair((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256))",
  closePair: "closePair(uint256,uint256,uint256,uint256)",
  shortOf: "shortOf(uint256)",
  longOf: "longOf(uint256)",
} as const;

export const charterCalls = {
  openBerth: () => s(SIG.openBerth),
  berthOf: (user: string) => `${s(SIG.berthOf)}${addr(user)}`,
  predictBerth: (user: string) => `${s(SIG.predictBerth)}${addr(user)}`,
};

export const leaseholdCalls = {
  deposit: (assets: bigint, receiver: string) => `${s(SIG.deposit)}${word(assets)}${addr(receiver)}`,
  redeem: (shares: bigint, receiver: string, owner: string) => `${s(SIG.redeem)}${word(shares)}${addr(receiver)}${addr(owner)}`,
  convertToAssets: (shares: bigint) => `${s(SIG.convertToAssets)}${word(shares)}`,
  maxRedeem: (owner: string) => `${s(SIG.maxRedeem)}${addr(owner)}`,
  available: () => s(SIG.available),
  totalAssets: () => s(SIG.totalAssets),
};

export const berthCalls = {
  openShort: (id: number, margin: bigint, stockAmount: bigint, minUsdgOut: bigint) => `${s(SIG.openShort)}${w(BigInt(id), margin, stockAmount, minUsdgOut)}`,
  closeShort: (id: number, maxUsdgIn: bigint) => `${s(SIG.closeShort)}${w(BigInt(id), maxUsdgIn)}`,
  openLong: (id: number, margin: bigint, loan: bigint, minStockOut: bigint) => `${s(SIG.openLong)}${w(BigInt(id), margin, loan, minStockOut)}`,
  closeLong: (id: number, minUsdgOut: bigint) => `${s(SIG.closeLong)}${w(BigInt(id), minUsdgOut)}`,
  openPair: (p: { longId: number; longMargin: bigint; loan: bigint; minStockOut: bigint; shortId: number; shortMargin: bigint; stockAmount: bigint; minUsdgOut: bigint }) =>
    `${s(SIG.openPair)}${w(BigInt(p.longId), p.longMargin, p.loan, p.minStockOut, BigInt(p.shortId), p.shortMargin, p.stockAmount, p.minUsdgOut)}`,
  closePair: (longId: number, shortId: number, maxUsdgIn: bigint, minUsdgOut: bigint) => `${s(SIG.closePair)}${w(BigInt(longId), BigInt(shortId), maxUsdgIn, minUsdgOut)}`,
  shortOf: (id: number) => `${s(SIG.shortOf)}${word(BigInt(id))}`,
  longOf: (id: number) => `${s(SIG.longOf)}${word(BigInt(id))}`,
};
