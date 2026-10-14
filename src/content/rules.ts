/*
 * The rules, in plain words. Shown on the home page (short lines that open), on /rules in full, and
 * referenced from each app panel. Written from what the contracts and Morpho actually do.
 */

export type Rule = { title: string; body: string; icon: "gap" | "loss" | "moon" | "queue" | "credit" | "lever" | "berth" | "owner" | "issuer" | "coin" | "clock" | "pool" };

export const RULES: Rule[] = [
  {
    icon: "gap",
    title: "A fast jump can cost lenders stock",
    body: "Each short is backed by USDG worth more than the stock it owes. If a stock leaps so far, so fast, that a short cannot be liquidated before its USDG runs out, Morpho books the missing stock as bad debt, and every lender in that stock's market absorbs it pro rata. Lenders are paid rent for carrying exactly this risk.",
  },
  {
    icon: "loss",
    title: "A short has no ceiling on its loss",
    body: "A stock can keep rising. When a short's debt passes the market's limit, anyone may liquidate it on Morpho: they hand back part of the stock and collect USDG from the margin plus an incentive. You can lose all of the margin you put in.",
  },
  {
    icon: "moon",
    title: "Prices rest on weekends, and so do new positions",
    body: "ONIXS prices everything with Chainlink's Robinhood stock-token feeds. They update around the clock from Sunday evening to Friday evening, New York time, then pause. Opening a short, a long or a pair needs a feed answer younger than 26 hours, so new positions wait for Monday. Closing never waits: it only needs the pool. Whatever the stock did over the weekend reaches the feed in one step on Sunday night.",
  },
  {
    icon: "queue",
    title: "Lent stock can be out on loan",
    body: "Stock that shorts have borrowed is not in the market until they return it. If every token of a stock is out, lenders withdraw as returns come in. Morpho's rate model climbs steeply as a market nears full use, which is what brings borrowers back.",
  },
  {
    icon: "credit",
    title: "A USDG loan against stock can be liquidated",
    body: "USDG loans against lent stock go up to 62.5% of its worth. Beyond that line a liquidator may repay part of the loan and take posted stock in return, keeping an incentive on top. The stock you post stays lent, so a bad-debt loss in the stock's lending market lowers what you posted as well.",
  },
  {
    icon: "lever",
    title: "Leverage multiplies both directions",
    body: "A leveraged long buys more stock than your USDG alone could, with a loan taken in your berth's name. The most is 1.8 times your margin, offered only on SPY, QQQ and NVDA. At 1.8x a 10% drop in the stock costs about 18% of your margin, and a fall of roughly 29% reaches the liquidation line.",
  },
  {
    icon: "berth",
    title: "Your positions sit in your own berth",
    body: "The first trade creates a berth: a small contract only your wallet can operate. Shorts, longs and pairs are Morpho positions held by that berth, never by a shared pool. ONIXS contracts keep nothing between transactions, and your berth has a direct exit: your wallet can call Morpho itself through it to repay, withdraw or move tokens out.",
  },
  {
    icon: "owner",
    title: "The owner lists and pauses, nothing more",
    body: "The ONIXS owner is one address written into the Charter when it was deployed, and it can never be changed or handed over. It can add a stock with fixed settings and can stop new positions on a listing. It cannot change a listing's markets, pool or limits after the fact, cannot close or move anyone's position, and cannot block a close. Lending and withdrawing happen on contracts that have no owner at all.",
  },
  {
    icon: "issuer",
    title: "The issuer controls the stock token",
    body: "Robinhood issues these stock tokens and can pause transfers, block an address or burn tokens. A pause or a block that touched Morpho, a leasehold or a berth would freeze the positions inside until it was lifted. ONIXS cannot override the issuer.",
  },
  {
    icon: "pool",
    title: "One-step trades meet a real pool",
    body: "Shorting sells borrowed stock, and leverage buys it, on the stock's Uniswap pool. A large order moves that pool's price; ONIXS refuses an opening fill further than 3% from the Chainlink price and always honours the minimum you set. Pool depth is shown on every panel.",
  },
  {
    icon: "clock",
    title: "Rent accrues every second",
    body: "Rent is Morpho interest on borrowed stock. It accrues continuously and compounds each time the market is touched; the rate floats with how much of the stock is out on loan. ‘Paid daily’ means your balance is a little larger every day, not that a payment lands at a fixed hour.",
  },
  {
    icon: "coin",
    title: "$ONIXS rewards come later and promise nothing",
    body: "Lenders are meant to earn $ONIXS on top of rent once a rewards contract exists. It does not exist yet, so no rewards are counted or owed today. $ONIXS carries no guaranteed value and may go to zero.",
  },
];
