import Link from "next/link";
import { Wordmark } from "@/components/Mark";
import { CaStrip } from "@/components/CopyCa";
import { FOOT_LINKS } from "@/components/site";
import { BRAND, CHAIN, hasGithub, hasX } from "@/config/brand";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="wrap grid grid-cols-1 gap-10 py-12 lg:grid-cols-[1fr_440px]">
        <div className="min-w-0">
          <Wordmark size={24} />
          <p className="mt-4 max-w-xl text-[13.5px] leading-relaxed text-ink-3">
            {BRAND.name} is built for {CHAIN.name} (network {CHAIN.id}) by an independent team. Robinhood, Morpho, Uniswap and Chainlink have no
            part in it and do not back it. Robinhood mints the stock tokens and keeps the power to pause, block or burn them. Lending and
            shorting can both lose money, and no page here is financial guidance.
          </p>
          <nav aria-label="Footer" className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13.5px]">
            {FOOT_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">
                {l.label}
              </Link>
            ))}
            {hasX ? (
              <a href={BRAND.x} target="_blank" rel="noreferrer" className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">
                X {BRAND.xHandle}
              </a>
            ) : null}
            {hasGithub ? (
              <a href={BRAND.github} target="_blank" rel="noreferrer" className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">
                GitHub
              </a>
            ) : null}
          </nav>
        </div>
        <div className="self-start">
          <CaStrip />
        </div>
      </div>
    </footer>
  );
}
