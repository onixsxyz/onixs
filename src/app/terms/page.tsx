import { BRAND, CHAIN } from "@/config/brand";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/terms", title: "Terms of Use", description: `Terms of use for the ${BRAND.name} website: what it is, the risks of lending, borrowing and shorting stock tokens, and what you agree to.` });

export default function Terms() {
  return (
    <div className="wrap prose-onixs max-w-3xl pt-14">
      <span className="band" />
      <h1 className="mt-4 text-[36px] font-bold">Terms of Use</h1>
      <p>Last updated 14 October 2026. Using {BRAND.domain} means agreeing to what follows; if you disagree, please stay off the site.</p>
      <h2>What this site is</h2>
      <p>{BRAND.name} is a website that reads public data from {CHAIN.name} and prepares transactions for contracts deployed there. It does not hold your keys, your tokens or your positions. Every transaction is signed by you in your own wallet, and once mined it cannot be reversed by anyone, including us.</p>
      <h2>No advice, no promises</h2>
      <p>Nothing on the site is financial, legal or tax guidance. Rates, prices and figures are read from the chain and third-party services and can be wrong, late or missing. Rent, interest and {BRAND.symbol} have no guaranteed level and can be zero.</p>
      <h2>Risks you accept</h2>
      <ul>
        <li>Smart contracts, including those of {BRAND.name}, Morpho, Uniswap and Chainlink, can contain bugs and can fail.</li>
        <li>Shorts and leveraged positions can be liquidated and can lose all of their margin; lenders can lose part of their stock if a short is liquidated too late.</li>
        <li>Stock tokens are issued by a third party that can pause, block or burn them. Price feeds pause outside market hours.</li>
        <li>Withdrawals can wait while lent assets are out on loan.</li>
      </ul>
      <h2>Your obligations</h2>
      <p>You are responsible for complying with the laws that apply to you, including any restriction in your country on holding or trading tokenized securities. Do not use the site for anything unlawful, to attack the contracts or the site, or to harm other users.</p>
      <h2>No warranty, limited liability</h2>
      <p>The site is provided as is, without warranty of any kind. As far as the law permits, {BRAND.name} and its contributors are not liable for any loss that comes from using the site or of the contracts it connects to.</p>
      <h2>Changes</h2>
      <p>These terms may change; the date above shows the latest version. Continuing to use the site after a change means you accept it.</p>
    </div>
  );
}
