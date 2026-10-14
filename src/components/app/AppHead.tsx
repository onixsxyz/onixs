export function AppHead({ title, children, aside, as = "h1" }: { title: string; children: React.ReactNode; aside?: React.ReactNode; as?: "h1" | "h2" }) {
  const H = as;
  return (
    <div className="grid grid-cols-1 gap-6 pt-10 pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
      <div className="min-w-0">
        <span className="band" />
        <H className="mt-4 text-[34px] font-bold tracking-tight sm:text-[40px]">{title}</H>
        <div className="mt-3 max-w-3xl text-[16px] leading-relaxed text-ink-2">{children}</div>
      </div>
      {aside ? <div className="min-w-0">{aside}</div> : null}
    </div>
  );
}

/** Thin notice under the tabs: what is live and what opens at launch. */
export function LaunchNote({ live }: { live: boolean }) {
  return (
    <p className="mt-4 rounded-xl border border-line px-4 py-3 text-[13.5px] text-ink-2" data-testid="launch-note">
      {live
        ? "Live on Robinhood Chain. Every number below is read from Morpho, Chainlink and Uniswap as you look."
        : "Prices, pools and Morpho are read live. The ONIXS markets open when the contracts are deployed: until then every action below shows its numbers and stays switched off."}
    </p>
  );
}
