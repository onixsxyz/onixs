// Single place to change project identity. Everything on the site reads from here.
// To publish the real contract address, replace the value of CA below. The navbar
// pill, the footer block, the token page and every explorer link derive from it.
// Anything that is not 0x + 40 hex characters is treated as "not launched yet".

const CA = "0xxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

// onixs.app was not registered when this was built (registry RDAP: not found, 14 Oct 2026). While false, the
// production *.vercel.app host is served as is (noindex) instead of redirecting to a domain that does not resolve.
// Set true once the domain is bought and attached in Vercel.
export const DOMAIN_LIVE = false;

export const isAddress = (v: string): v is `0x${string}` => /^0x[0-9a-fA-F]{40}$/.test(v);

const NAME = "ONIXS";
const TICKER = "ONIXS";
const DOMAIN = "onixs.app";
const X_HANDLE = "onixsxyz";

export const BRAND = {
  name: NAME,
  slug: "onixs",
  ticker: TICKER,
  symbol: `$${TICKER}`,
  domain: DOMAIN,
  url: `https://${DOMAIN}`,
  slogan: "Lend Stocks. Earn Rent. Short at Your Own Risk.",
  tagline: "Deposit stock tokens. Shorts borrow and pay rent daily. Earn on-chain. Non-custodial. All transparent.",
  category: "stock token lending protocol",
  chainName: "Robinhood Chain",
  x: `https://x.com/${X_HANDLE}`,
  xHandle: `@${X_HANDLE}`,
  // Public source repository. Bare host = not published yet, so it stays off the site.
  github: "https://github.com/",
  ca: CA,
} as const;

/** True once BRAND.github points at an actual repository, not the bare host. */
export const hasGithub = /^https:\/\/github\.com\/[^/]+/.test(BRAND.github);
/** True when the X link is a real profile (always, for ONIXS). */
export const hasX = /^https:\/\/x\.com\/[A-Za-z0-9_]+$/.test(BRAND.x);

// Public endpoints are the default. An operator can point the site at a private RPC with
// ROBINHOOD_RPC_URL (server) / NEXT_PUBLIC_ROBINHOOD_RPC_URL (browser). Both are optional.
const PUBLIC_RPC = "https://rpc.mainnet.chain.robinhood.com";

export const CHAIN = {
  id: 4663,
  hex: "0x1237",
  name: "Robinhood Chain",
  nativeSymbol: "ETH",
  decimals: 18,
  publicRpc: PUBLIC_RPC,
  rpc: process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || PUBLIC_RPC,
  /** Second public endpoint, used for reads only when the first one fails. */
  fallbackRpc: "https://robinhood-rpc.publicnode.com",
  /** Third read endpoint for server code (some networks intercept the official host). */
  spareRpc: "https://robinhood.drpc.org",
  explorer: "https://robinhoodchain.blockscout.com",
} as const;

/** RPC for server code: the private endpoint when set, else the public one. */
export function serverRpc() {
  return process.env.ROBINHOOD_RPC_URL || process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || PUBLIC_RPC;
}

export const TOKEN = {
  get isLive() {
    return isAddress(BRAND.ca);
  },
  get explorerUrl() {
    return isAddress(BRAND.ca) ? explorerToken(BRAND.ca) : null;
  },
  /** The coin's page on the Pons launchpad, once the address is real. */
  get ponsUrl() {
    return isAddress(BRAND.ca) ? `https://www.ponsfamily.com/launchpad/${BRAND.ca.toLowerCase()}` : null;
  },
};

export const explorerAddress = (address: string) => `${CHAIN.explorer}/address/${address}`;
export const explorerToken = (address: string) => `${CHAIN.explorer}/token/${address}`;
export const explorerTx = (hash: string) => `${CHAIN.explorer}/tx/${hash}`;
export function shortAddress(address: string, head = 6, tail = 4) {
  if (address.length <= head + tail + 2) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

/** USDG ("Global Dollar"), read on chain: symbol USDG, 6 decimals. Many look-alikes share the symbol. */
export const USDG = {
  address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
  symbol: "USDG",
  name: "Global Dollar",
  decimals: 6,
  feed: "0x61B7e5650328764B076A108EFF5fa7282a1B9aD2",
} as const;

export const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
