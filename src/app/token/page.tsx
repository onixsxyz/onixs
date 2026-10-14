import Link from "next/link";
import { CaStrip } from "@/components/CopyCa";
import { BRAND, CHAIN, TOKEN, hasX, isAddress } from "@/config/brand";
import { decodeStringAt } from "@/lib/calls";
import { rpcBatch } from "@/lib/feeds/rpc";
import { breadcrumbLd, ldJson, pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMeta({ path: "/token", title: `${BRAND.name} (${BRAND.symbol}) Token`, description: `${BRAND.symbol} is the ${BRAND.name} token on Robinhood Chain, launched on Pons. Contract address, supply read on chain, and where rewards stand.` });

async function onchain() {
  if (!isAddress(BRAND.ca)) return null;
  const c = (data: string) => ({ method: "eth_call", params: [{ to: BRAND.ca, data }, "latest"] });
  const r = await rpcBatch<string>([c("0x06fdde03"), c("0x95d89b41"), c("0x18160ddd"), c("0x313ce567")]).catch(() => null);
  if (!r) return null;
  const dec = r[3] ? Number(BigInt(r[3])) : 18;
  return { name: r[0] ? decodeStringAt(r[0]) : null, symbol: r[1] ? decodeStringAt(r[1]) : null, supply: r[2] ? Number(BigInt(r[2]) / 10n ** BigInt(dec)) : null };
}

export default async function TokenPage() {
  const facts = await onchain();
  return (
    <div className="wrap pt-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumbLd([{ name: "Token", path: "/token" }]))} />
      <span className="band" />
      <h1 className="mt-4 font-display text-[38px] leading-tight font-black sm:text-[48px]" style={{ fontStretch: "118%" }}>
        {BRAND.name} ({BRAND.symbol}) token
      </h1>
      <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink-2">
        {BRAND.symbol} is the coin of {BRAND.name}, launched on the Pons launchpad on {CHAIN.name}. The plan is to share it among stock and USDG
        lenders on top of the rent they earn. It promises nothing: no value, no income.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <CaStrip large />
        <div className="slab p-5 sm:p-6">
          <div className="kv"><span>Name</span><span>{facts?.name ?? BRAND.name}</span></div>
          <div className="kv"><span>Ticker</span><span>{facts?.symbol ? `$${facts.symbol}` : BRAND.symbol}</span></div>
          <div className="kv"><span>Network</span><span>{CHAIN.name} · {CHAIN.id}</span></div>
          <div className="kv"><span>Supply (read on chain)</span><span>{facts?.supply ? facts.supply.toLocaleString("en-US") : "At launch"}</span></div>
          <div className="kv"><span>Launchpad</span><span>{TOKEN.ponsUrl ? <a className="link" href={TOKEN.ponsUrl} target="_blank" rel="noreferrer">Pons</a> : "Pons, at launch"}</span></div>
          <div className="kv"><span>Rewards to lenders</span><span className="text-ink-3">Later</span></div>
        </div>
      </div>
      <section className="mt-12 max-w-3xl" aria-labelledby="buy">
        <h2 id="buy" className="text-[24px] font-bold">How to buy {BRAND.symbol}</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-[15.5px] leading-relaxed text-ink-2">
          <li>Add {CHAIN.name} to an EVM wallet (the connect dialog does it) and hold a little ETH on it for gas.</li>
          <li>Copy the contract address from this page{hasX ? ` or from ${BRAND.xHandle} on X` : ""}. Nowhere else is authoritative.</li>
          <li>Open the coin on Pons and check that the address there matches, character for character, before you buy.</li>
        </ol>
        <p className="mt-4 text-[14.5px] text-ink-3">
          Until launch the address reads &ldquo;coming soon&rdquo;: any {BRAND.symbol} you see trading before it is posted here is not ours. More in the{" "}
          <Link href="/docs#faq" className="link">docs</Link>.
        </p>
      </section>
    </div>
  );
}
