# ONIXS — Deposit stock tokens. Shorts borrow and pay rent daily. Earn on-chain. Non-custodial. All transparent.

**Lend Stocks. Earn Rent. Short at Your Own Risk.** ONIXS is a stock token lending protocol on Robinhood Chain:
lend SPY, QQQ or NVDA stock tokens for rent paid by shorts, borrow USDG against them, short in one transaction,
lever a long up to 1.8x, or trade one stock against another. Website: https://onixs.app · X: https://x.com/onixsxyz

## The problem

Tokenized shares on Robinhood Chain mostly sit still. A holder of SPY, QQQ or NVDA tokens earns nothing for
holding them, cannot borrow dollars against them without selling, and anyone who thinks a stock is overpriced has no
simple way to borrow it and sell it. The pieces to fix this exist on chain (Morpho lending markets, Chainlink stock
feeds, Uniswap pools), but wiring them together by hand takes several contracts and a dozen transactions.

## The solution

ONIXS lists each stock with two Morpho markets and a set of small contracts that do the wiring:

- **Lend a stock, collect rent.** The stock's *leasehold* (an ERC-4626 vault with no owner and no fee) supplies
  everything to a Morpho market where shorts borrow it. Their interest accrues to lenders every second.
- **Lend USDG** to people who borrow dollars against their lent stock.
- **Borrow USDG** against leasehold shares, up to 62.5% of their value, while the stock underneath keeps earning.
- **Short in one transaction**: borrow the stock, sell it on its Uniswap pool, hold the USDG as collateral.
- **Leveraged long** up to 1.8x on SPY, QQQ and NVDA, and **pair trades** (long one, short another) in one signature.
- **$ONIXS rewards** for lenders are planned on top of rent; they are not live.

## How it works

| Contract | Role |
| --- | --- |
| `OnixsLeasehold` | One per stock. ERC-4626, no owner, no fee. Supplies all deposits to the stock's short market on Morpho. |
| `OnixsMark` | Morpho oracle. Chainlink stock price × the token's dividend multiplier; USDG at its own feed, never above $1. Two per stock (short mode, credit mode). Never reverts on a stale price, so repay and liquidation always work. |
| `OnixsCharter` | Registry of listings (fixed once listed; the owner can only list a stock or pause new positions) and factory of berths. Its owner is an immutable set at deployment: it can never be transferred or replaced. Every berth reports its activity here. |
| `OnixsBerth` | A minimal proxy per wallet, owned by that wallet only. Holds its shorts and leveraged longs on Morpho, swaps on the listing's Uniswap v3 pool, and has an owner-only escape hatch. |

Per stock: a **short market** (loan: the stock, collateral: USDG) and a **credit market** (loan: USDG, collateral:
leasehold shares), both on Morpho Blue with the adaptive rate model. New positions need a Chainlink answer younger than
26 hours and a pool price within 3% of it; closing needs only the pool, so it works on weekends when the stock feeds rest.

## What you can try

Live now (read from the chain): stock token prices with feed age, pool depth and pool-vs-feed gap, Morpho data, the
Verify tab (token identity by Robinhood's beacon, feeds, pools, Morpho settings), wallet connection on Robinhood Chain.

Coming later: every lending, borrowing, shorting, leverage and pair action is wired in the app and switches on as soon
as the contract addresses are filled in `src/config/contracts.ts`. $ONIXS rewards need a rewards contract that does
not exist yet.

## Run it locally

Download the ZIP of this repository or fork it, then:

```bash
node --version          # 20 or newer
npm install
npm run build
npm start               # http://localhost:5040
```

Optional environment variables (put them in `.env.local`; see `.env.example`):

| Name | Purpose |
| --- | --- |
| `ROBINHOOD_RPC_URL` | Server-side RPC (e.g. your Alchemy endpoint). Empty: public RPC with fallbacks. |
| `NEXT_PUBLIC_ROBINHOOD_RPC_URL` | RPC the browser may call. Public, so never a secret key. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Reown project id for WalletConnect. Empty: shown as not configured. |

Tests: `npm test` (relay rules, calldata checked against the compiled ABI). Contracts (Foundry):

```bash
cd contracts && ./setup.sh             # fetches forge-std and OpenZeppelin 5.1.0 into contracts/lib
forge test --match-contract OnixsMarkTest   # unit tests, offline
./fork-test.sh                          # fork tests against Robinhood Chain mainnet (real Morpho, pools and feeds)
node --test ../scripts/verify-lib.test.mjs
```

After a deployment, `npm run verify-deployment -- --owner <address>` proves that every address in
`src/config/contracts.ts` runs this build: creation transaction, bytecode and constructor arguments.

## Robinhood Chain in your wallet

Network name Robinhood Chain · chain id 4663 (0x1237) · RPC https://rpc.mainnet.chain.robinhood.com · currency ETH ·
explorer https://robinhoodchain.blockscout.com. The connect dialog adds it for you.

## Project layout

```
src/app            pages (home, /app tabs, docs, rules, token) and API routes (/api/board, /api/rpc)
src/components     header, footer, CA strip, wallet dialog, app desks
src/config         brand.ts (name, CA), stocks.ts (verified tokens, feeds, pools), contracts.ts (addresses)
src/lib            ABI encoding, Morpho math, relay rules, ONIXS calldata, portfolio reader
contracts          Foundry project: OnixsMark, OnixsLeasehold, OnixsCharter, OnixsBerth + tests
scripts            artifacts export and verify-deployment
```

## Contracts and token

- $ONIXS contract address: published at launch on this README, the website and X.
- ONIXS contracts: not deployed yet. Addresses will be listed here and verified on Blockscout.
- External: Morpho Blue `0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010`, adaptive IRM `0x2BD3d5965B26B51814AC95127B2b80dD6CcC0fa1`,
  USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`, Uniswap v3 factory `0x1f7d7550b1b028f7571e69a784071f0205fd2efa`.

## Security and status

Lenders can lose stock if a short becomes bad debt; shorts can lose their whole margin; Robinhood can pause, block or
burn stock tokens. The owner of `OnixsCharter` is fixed forever at deployment (there is no transfer function) and can list stocks and pause new positions, nothing else. The full list is
on the site's Rules page. Please report a vulnerability privately (a direct message to @onixsxyz on X) before disclosing it.

## Contributing

Issues and pull requests are welcome. Keep code, comments and copy in English, run `npx tsc --noEmit`, `npm test` and
`forge test` before opening a pull request.

## License

MIT
