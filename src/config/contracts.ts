/*
 * ONIXS contract addresses on Robinhood Chain. Empty strings until the owner deploys them from the
 * local-only /deploy page; while empty the site reads the chain (prices, pools, Morpho) and every
 * money button that needs an ONIXS contract says it opens at launch.
 * scripts/verify-deployment.mjs reads this file and checks each address against its creation transaction.
 */

export const CHARTER = "0x867682fdf35198cd458e68ed09bad44ce9dd613f";
export const CHARTER_BLOCK = 88389060;

export const LISTINGS: { symbol: "SPY" | "QQQ" | "NVDA"; shortMark: string; leasehold: string; creditMark: string; block: number }[] = [
  { symbol: "SPY", shortMark: "0x08224ed19045546f418436f30533d430895e25d1", leasehold: "0xcf87d58b258ae3a1275a626e58d841b3481b7505", creditMark: "0x1097439a6312a82cf44e6233a5e295a50ebcc261", block: 88389148 },
  { symbol: "QQQ", shortMark: "0x18760ff2638c0de700bf1cc774c3dbd165935d77", leasehold: "0x11f4f8d99e344dde138e2e43953a1df65bed2902", creditMark: "0x4469418147d8df879012280f6fc3c2eb12faa0db", block: 88389524 },
  { symbol: "NVDA", shortMark: "0x0e4b7066f2af62f29f12ece615d3cdae3576a91c", leasehold: "0xb1e8b266b3e120b99b355d6204d216cfd68d2d8a", creditMark: "0xef114bf990b344aca025676efb0b97d5f1b0a193", block: 88390218 },
];

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
