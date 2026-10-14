import { keccak_256 } from "@noble/hashes/sha3.js";
import { address as addr, bytes, dynamic, encode, fixed, readWord, word } from "@/lib/abi";

/*
 * Morpho Blue calldata, market ids and share math, without a library. Shared by the browser and the server.
 * Positions opened from this site belong to the wallet (or to the wallet's own berth contract) on Morpho.
 */

export type MarketParams = { loanToken: string; collateralToken: string; oracle: string; irm: string; lltv: bigint };
export type MarketState = { totalSupplyAssets: bigint; totalSupplyShares: bigint; totalBorrowAssets: bigint; totalBorrowShares: bigint; lastUpdate: bigint; fee: bigint };
export type Position = { supplyShares: bigint; borrowShares: bigint; collateral: bigint };

export const SEL = {
  supply: "a99aad89",
  withdraw: "5c2bea49",
  borrow: "50d8cd4b",
  repay: "20b76e81",
  supplyCollateral: "238d6579",
  withdrawCollateral: "8720316d",
  position: "93c52062",
  market: "5c60e39a",
  idToMarketParams: "2c3c9157",
  price: "a035b1fe",
  borrowRateView: "8c00bf6b",
  approve: "095ea7b3",
  allowance: "dd62ed3e",
  balanceOf: "70a08231",
  totalSupply: "18160ddd",
  decimals: "313ce567",
  latestRoundData: "feaf968c",
  uiMultiplier: "a60bf13d",
  slot0: "3850c7bd",
  totalAssets: "01e1d114",
  convertToAssets: "07a2d13a",
  maxWithdraw: "ce96cb77",
} as const;

export const paramsHex = (p: MarketParams) => addr(p.loanToken) + addr(p.collateralToken) + addr(p.oracle) + addr(p.irm) + word(p.lltv);
const id32 = (id: string) => id.slice(2).toLowerCase().padStart(64, "0");

/** Morpho's market id: keccak256 of the ABI-encoded parameters. */
export function marketId(p: MarketParams) {
  const hex = paramsHex(p);
  const bytesArr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytesArr.length; i++) bytesArr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return `0x${Array.from(keccak_256(bytesArr), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export const encodeSupply = (p: MarketParams, assets: bigint, shares: bigint, onBehalf: string) =>
  `0x${SEL.supply}` + encode([fixed(paramsHex(p)), fixed(word(assets)), fixed(word(shares)), fixed(addr(onBehalf)), dynamic(bytes("0x"))]);
export const encodeWithdraw = (p: MarketParams, assets: bigint, shares: bigint, onBehalf: string, receiver: string) =>
  `0x${SEL.withdraw}${paramsHex(p)}${word(assets)}${word(shares)}${addr(onBehalf)}${addr(receiver)}`;
export const encodeBorrow = (p: MarketParams, assets: bigint, shares: bigint, onBehalf: string, receiver: string) =>
  `0x${SEL.borrow}${paramsHex(p)}${word(assets)}${word(shares)}${addr(onBehalf)}${addr(receiver)}`;
export const encodeRepay = (p: MarketParams, assets: bigint, shares: bigint, onBehalf: string) =>
  `0x${SEL.repay}` + encode([fixed(paramsHex(p)), fixed(word(assets)), fixed(word(shares)), fixed(addr(onBehalf)), dynamic(bytes("0x"))]);
export const encodeSupplyCollateral = (p: MarketParams, assets: bigint, onBehalf: string) =>
  `0x${SEL.supplyCollateral}` + encode([fixed(paramsHex(p)), fixed(word(assets)), fixed(addr(onBehalf)), dynamic(bytes("0x"))]);
export const encodeWithdrawCollateral = (p: MarketParams, assets: bigint, onBehalf: string, receiver: string) =>
  `0x${SEL.withdrawCollateral}${paramsHex(p)}${word(assets)}${addr(onBehalf)}${addr(receiver)}`;
export const encodeMarket = (id: string) => `0x${SEL.market}${id32(id)}`;
export const encodePosition = (id: string, user: string) => `0x${SEL.position}${id32(id)}${addr(user)}`;
export const encodeBorrowRateView = (p: MarketParams, s: MarketState) =>
  `0x${SEL.borrowRateView}${paramsHex(p)}${word(s.totalSupplyAssets)}${word(s.totalSupplyShares)}${word(s.totalBorrowAssets)}${word(s.totalBorrowShares)}${word(s.lastUpdate)}${word(s.fee)}`;

export function decodeState(hex: string): MarketState {
  return {
    totalSupplyAssets: readWord(hex, 0),
    totalSupplyShares: readWord(hex, 1),
    totalBorrowAssets: readWord(hex, 2),
    totalBorrowShares: readWord(hex, 3),
    lastUpdate: readWord(hex, 4),
    fee: readWord(hex, 5),
  };
}
export const decodePosition = (hex: string): Position => ({ supplyShares: readWord(hex, 0), borrowShares: readWord(hex, 1), collateral: readWord(hex, 2) });

// Morpho's SharesMathLib: one virtual share and 1e6 virtual shares per asset unit.
const VIRTUAL_SHARES = 1_000_000n;
const VIRTUAL_ASSETS = 1n;
export const toAssetsDown = (shares: bigint, totalAssets: bigint, totalShares: bigint) => (shares * (totalAssets + VIRTUAL_ASSETS)) / (totalShares + VIRTUAL_SHARES);
export const toAssetsUp = (shares: bigint, totalAssets: bigint, totalShares: bigint) => {
  const d = totalShares + VIRTUAL_SHARES;
  return (shares * (totalAssets + VIRTUAL_ASSETS) + d - 1n) / d;
};

const YEAR = 31_536_000;
/** Borrow APR and the lenders' APR from the IRM's per-second rate (1e18-scaled), utilisation and market fee. */
export function rates(ratePerSec: bigint | null, s: MarketState) {
  const util = s.totalSupplyAssets > 0n ? Number((s.totalBorrowAssets * 1_000_000n) / s.totalSupplyAssets) / 1e6 : 0;
  if (ratePerSec === null) return { util, borrowApr: null, supplyApr: null };
  const borrowApr = (Number(ratePerSec) / 1e18) * YEAR;
  const supplyApr = borrowApr * util * (1 - Number(s.fee) / 1e18);
  return { util, borrowApr, supplyApr };
}
