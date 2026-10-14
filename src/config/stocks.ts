/*
 * Stock tokens ONIXS lists, and the ones it watches. Every address was read on chain (14 Oct 2026):
 * the token's runtime code embeds Robinhood's stock-token beacon 0xe10b6f6b…1b00, symbol() matches exactly
 * and name() ends in "• Robinhood Token"; each feed is the Chainlink proxy whose description names the same
 * stock. Tickers alone identify nothing on this chain: dozens of look-alike tokens reuse them.
 *
 * Feeds price one share as the app shows it. A token's raw balance converts to shares through its
 * uiMultiplier (dividends raise it), so the dollar value of a raw token is answer × uiMultiplier.
 */

export type Stock = {
  symbol: string;
  name: string;
  token: `0x${string}`;
  /** Chainlink USD proxy, 8 decimals, US equities 24/5 schedule. */
  feed: `0x${string}`;
  /** Uniswap v3 stock/USDG pool (0.05% tier) the one-step trades fill against. */
  pool?: `0x${string}`;
  logo: string;
};

/** Launch markets: lend, borrow USDG, short, leverage (up to 1.8x) and pairs. */
export const LISTED: Stock[] = [
  { symbol: "SPY", name: "S&P 500 ETF", token: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C", feed: "0x319724394D3A0e3669269846abE664Cd621f9f6A", pool: "0xa7Bb1AC63BBaB0C44316E6c8C455213441689167", logo: "/stocks/spy.webp" },
  { symbol: "QQQ", name: "Invesco QQQ", token: "0xD5f3879160bc7c32ebb4dC785F8a4F505888de68", feed: "0x80901d846d5D7B030F26B480776EE3b29374C2ae", pool: "0xD60A5d14dB690B7Afad71F76B108071D7175597d", logo: "/stocks/qqq.webp" },
  { symbol: "NVDA", name: "NVIDIA", token: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC", feed: "0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15", pool: "0xd4EB21209C4D6093f80B5b84f5C45cc093EA14a3", logo: "/stocks/nvda.webp" },
];

/** Watched with live prices; not listed for lending yet. */
export const WATCH: Stock[] = [
  { symbol: "TSLA", name: "Tesla", token: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d", feed: "0x4A1166a659A55625345e9515b32adECea5547C38", logo: "/stocks/tsla.webp" },
  { symbol: "AAPL", name: "Apple", token: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9", feed: "0x6B22A786bAa607d76728168703a39Ea9C99f2cD0", logo: "/stocks/aapl.webp" },
  { symbol: "MSFT", name: "Microsoft", token: "0xe93237C50D904957Cf27E7B1133b510C669c2e74", feed: "0x45C3C877C15E6BA2EBB19eA114Ea508d14C1Af2E", logo: "/stocks/msft.webp" },
  { symbol: "META", name: "Meta Platforms", token: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35", feed: "0x7C38C00C30BEe9378381E7B6135d7283356D71b1", logo: "/stocks/meta.webp" },
  { symbol: "AMZN", name: "Amazon", token: "0x12f190a9F9d7D37a250758b26824B97CE941bF54", feed: "0xD5a1508ceD74c084eBf3cBe853e2C968fB2a651C", logo: "/stocks/amzn.webp" },
  { symbol: "GOOGL", name: "Alphabet A", token: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3", feed: "0xF6f373a037c30F0e5010d854385cA89185AE638b", logo: "/stocks/googl.webp" },
  { symbol: "COIN", name: "Coinbase", token: "0x6330D8C3178a418788dF01a47479c0ce7CCF450b", feed: "0xA3a468A452940B7D6b69991207B508c609a98Ef2", logo: "/stocks/coin.webp" },
];

export const ALL_STOCKS = [...LISTED, ...WATCH];
export const findListed = (symbol: string) => LISTED.find((s) => s.symbol.toLowerCase() === symbol.toLowerCase()) ?? null;

/**
 * Suggested listing parameters (the owner sets the final values once, on chain, with OnixsCharter.list).
 * shortLltv: Morpho LLTV of the market where the stock is borrowed against USDG.
 * creditLltv: Morpho LLTV of the market where USDG is borrowed against lent stock (leasehold shares).
 * shortOpenLtv: the most a new short may use at opening, below shortLltv, so it is not born at the edge.
 * maxLeverage: the longest one-step leveraged long (1.8x), only on these three.
 * maxSlip: how far the pool may sit from the Chainlink price when a position opens.
 * maxFeedAge: opens are refused when the feed is older than this (it rests over weekends); closes never are.
 */
export const LISTING_PARAMS: Record<string, { shortLltv: number; creditLltv: number; shortOpenLtv: number; maxLeverage: number; maxSlip: number; maxFeedAgeH: number }> = {
  SPY: { shortLltv: 0.77, creditLltv: 0.625, shortOpenLtv: 0.65, maxLeverage: 1.8, maxSlip: 0.03, maxFeedAgeH: 26 },
  QQQ: { shortLltv: 0.77, creditLltv: 0.625, shortOpenLtv: 0.65, maxLeverage: 1.8, maxSlip: 0.03, maxFeedAgeH: 26 },
  NVDA: { shortLltv: 0.625, creditLltv: 0.625, shortOpenLtv: 0.5, maxLeverage: 1.8, maxSlip: 0.03, maxFeedAgeH: 26 },
};

/** Robinhood's stock-token beacon, embedded in the code of every official stock token. */
export const STOCK_BEACON = "0xe10b6f6b275de231345c20d14ab812db62151b00";
