import { BRAND } from "@/config/brand";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/privacy", title: "Privacy Policy", description: `What the ${BRAND.name} website collects (almost nothing), what stays in your browser, what the relay sees and what is public on Robinhood Chain.` });

export default function Privacy() {
  return (
    <div className="wrap prose-onixs max-w-3xl pt-14">
      <span className="band" />
      <h1 className="mt-4 text-[36px] font-bold">Privacy Policy</h1>
      <p>Last updated 14 October 2026.</p>
      <h2>No accounts, no cookies for tracking</h2>
      <p>{BRAND.name} has no sign-up, sets no advertising or analytics cookies and runs no third-party trackers. Your browser stores one thing for the site: which wallet you last connected, so the connection can resume.</p>
      <h2>What the server sees</h2>
      <p>To read the chain, the site relays read-only requests through its own server. Those requests carry your IP address and, when you look at your own positions, your public wallet address. They are used only to answer the request and to rate-limit abuse, kept in memory and not stored.</p>
      <h2>What is public anyway</h2>
      <p>Everything you do with the contracts is recorded on Robinhood Chain, which is open to everyone and permanent: any observer can link your wallet address to its lending, borrowing and trading there. This site cannot hide or delete it.</p>
      <h2>Third parties</h2>
      <p>Your wallet, its RPC provider, WalletConnect if you use it, and the hosting provider handle data under their own policies.</p>
    </div>
  );
}
