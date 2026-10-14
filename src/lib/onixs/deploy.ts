import { address as addr, bytes, dynamic, encode, fixed, word } from "@/lib/abi";
import { selector } from "@/lib/calls";
import { paramsHex, type MarketParams } from "@/lib/morpho";

/*
 * Constructor arguments and the list() call for the owner's /deploy page, ABI-encoded by hand.
 * src/lib/deploy.test.ts compares each one with `cast abi-encode` output.
 */

const utf8Hex = (s: string) => Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, "0")).join("");

export const charterArgs = (owner: string, morpho: string, usdg: string, factory: string) => addr(owner) + addr(morpho) + addr(usdg) + addr(factory);
export const markArgs = (stockFeed: string, stock: string, usdgFeed: string, usdg: string, leasehold: string) =>
  addr(stockFeed) + addr(stock) + addr(usdgFeed) + addr(usdg) + addr(leasehold);
export const leaseholdArgs = (stock: string, morpho: string, short: MarketParams, name: string, symbol: string) =>
  encode([fixed(addr(stock)), fixed(addr(morpho)), fixed(paramsHex(short)), dynamic(bytes(utf8Hex(name))), dynamic(bytes(utf8Hex(symbol)))]);

export type ListingInput = {
  stock: string;
  feed: string;
  pool: string;
  leasehold: string;
  short: MarketParams;
  credit: MarketParams;
  maxLeverageBps: number;
  shortOpenLtvBps: number;
  maxSlipBps: number;
  maxFeedAge: number;
  paused: boolean;
};

export const LIST_SIG = "list((address,address,address,address,(address,address,address,address,uint256),(address,address,address,address,uint256),uint16,uint16,uint16,uint32,bool))";

export const encodeList = (l: ListingInput) =>
  `0x${selector(LIST_SIG)}` +
  addr(l.stock) + addr(l.feed) + addr(l.pool) + addr(l.leasehold) + paramsHex(l.short) + paramsHex(l.credit) +
  word(BigInt(l.maxLeverageBps)) + word(BigInt(l.shortOpenLtvBps)) + word(BigInt(l.maxSlipBps)) + word(BigInt(l.maxFeedAge)) + word(l.paused);
