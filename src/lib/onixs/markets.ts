import { USDG } from "@/config/brand";
import { LISTINGS, MORPHO, charterLive } from "@/config/contracts";
import { LISTED, LISTING_PARAMS } from "@/config/stocks";
import { marketId, type MarketParams } from "@/lib/morpho";

/*
 * The two Morpho markets ONIXS lists per stock, rebuilt from config so the browser and the server agree:
 *   short market  — loan: the stock,  collateral: USDG,              oracle: the stock's short-mode OnixsMark
 *   credit market — loan: USDG,       collateral: leasehold shares,   oracle: the stock's credit-mode OnixsMark
 * The listing id on the Charter is the index in LISTINGS (they are listed in that order).
 */

const e18 = (n: number) => BigInt(Math.round(n * 1000)) * 10n ** 15n;

export type Desk = {
  id: number;
  symbol: string;
  stock: (typeof LISTED)[number];
  leasehold: string;
  short: MarketParams;
  credit: MarketParams;
  shortId: string;
  creditId: string;
  params: (typeof LISTING_PARAMS)[string];
};

export function desks(): Desk[] {
  if (!charterLive()) return [];
  return LISTINGS.flatMap((l, id) => {
    const stock = LISTED.find((s) => s.symbol === l.symbol);
    const params = LISTING_PARAMS[l.symbol];
    if (!stock || !params) return [];
    const short: MarketParams = { loanToken: stock.token, collateralToken: USDG.address, oracle: l.shortMark, irm: MORPHO.adaptiveIrm, lltv: e18(params.shortLltv) };
    const credit: MarketParams = { loanToken: USDG.address, collateralToken: l.leasehold, oracle: l.creditMark, irm: MORPHO.adaptiveIrm, lltv: e18(params.creditLltv) };
    return [{ id, symbol: l.symbol, stock, leasehold: l.leasehold, short, credit, shortId: marketId(short), creditId: marketId(credit), params }];
  });
}

export const deskOf = (symbol: string) => desks().find((d) => d.symbol === symbol) ?? null;
