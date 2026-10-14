/*
 * ONIXS contract addresses on Robinhood Chain. Empty strings until the owner deploys them from the
 * local-only /deploy page; while empty the site reads the chain (prices, pools, Morpho) and every
 * money button that needs an ONIXS contract says it opens at launch.
 * scripts/verify-deployment.mjs reads this file and checks each address against its creation transaction.
 */

export const CHARTER = "";
export const CHARTER_BLOCK = 0;

export const LISTINGS: { symbol: "SPY" | "QQQ" | "NVDA"; shortMark: string; leasehold: string; creditMark: string; block: number }[] = [];

/** Morpho Blue and its pieces on Robinhood Chain (code read on chain, 14 Oct 2026). */
export const MORPHO = {
  blue: "0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010",
  adaptiveIrm: "0x2BD3d5965B26B51814AC95127B2b80dD6CcC0fa1",
} as const;

export const UNISWAP_V3 = {
  factory: "0x1f7d7550b1b028f7571e69a784071f0205fd2efa",
  quoterV2: "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7",
} as const;

export const charterLive = () => /^0x[0-9a-fA-F]{40}$/.test(CHARTER);
export const listingOf = (symbol: string) => LISTINGS.find((l) => l.symbol === symbol) ?? null;
