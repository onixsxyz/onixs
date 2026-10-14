/** Questions people ask first. Shown on the home page (first six) and on /docs, with FAQPage data on /docs. */
export const FAQ = [
  {
    q: "What is ONIXS?",
    a: "ONIXS is a stock token lending protocol on Robinhood Chain. You lend tokenized shares such as SPY, QQQ or NVDA and earn rent from people who borrow them to short. You can also borrow USDG against lent stock, open a short or a leveraged long in one transaction, or trade one stock against another.",
  },
  {
    q: "How does ONIXS work?",
    a: "Each listed stock has two Morpho markets. In the first, the stock is lent and USDG is the collateral: lenders supply through the stock's leasehold contract and shorts borrow from it. In the second, USDG is lent against leasehold shares, so lenders can borrow dollars without selling. Shorts, longs and pairs run through a berth, a small contract each wallet owns, which borrows, swaps on Uniswap and posts collateral in one transaction.",
  },
  {
    q: "Where does the rent come from?",
    a: "From shorts. Borrowing a stock token costs interest, set by Morpho's adaptive rate model from how much of the stock is out on loan. That interest accrues every second to the market's lenders, which is why a leasehold share is worth a little more stock each day.",
  },
  {
    q: "Which network is ONIXS on?",
    a: "Robinhood Chain mainnet, chain id 4663, with ETH for gas. The connect dialog adds the network to your wallet if it is missing. Phantom cannot add custom networks, so it is shown but disabled.",
  },
  {
    q: "How do I buy $ONIXS?",
    a: "$ONIXS launches on the Pons launchpad on Robinhood Chain. The contract address is published on this site and on X at launch; until then the copy buttons read 'At launch'. Always check the address before buying, because look-alike tokens reuse names.",
  },
  {
    q: "What happens over the weekend?",
    a: "The stock feeds pause from Friday to Sunday evening, New York time. ONIXS refuses new shorts, longs and pairs when a feed is older than 26 hours, so nothing new is sized on a stale price. Closing, repaying, lending and withdrawing keep working.",
  },
  {
    q: "Can ONIXS take my tokens?",
    a: "Lent stock sits in Morpho in the leasehold's name and leaseholds have no owner. Positions sit in your berth, which only your wallet can operate. The ONIXS owner, fixed forever when the Charter was deployed, can list stocks and pause new positions; it cannot move, close or freeze anyone's funds. The stock token's issuer can, which is a risk ONIXS cannot remove.",
  },
  {
    q: "What does it cost?",
    a: "ONIXS charges no fee of its own today. You pay gas in ETH, the Uniswap pool fee (0.05%) and price impact on one-step trades, and Morpho interest on whatever you borrow.",
  },
  {
    q: "How much can I short or leverage?",
    a: "A new short may borrow stock worth up to 65% of the USDG held against it on SPY and QQQ, and 50% on NVDA, safely below each market's liquidation line (77% and 62.5%). Leveraged longs go up to 1.8 times the margin, on SPY, QQQ and NVDA only. Pool depth also caps size, and the app shows it.",
  },
];
