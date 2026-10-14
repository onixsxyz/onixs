import { RuleIcon } from "@/components/RuleIcon";
import { RULES } from "@/content/rules";
import { BRAND } from "@/config/brand";
import { breadcrumbLd, ldJson, pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/rules", title: "Rules", description: `The ${BRAND.name} rules in plain words: lender risk, short losses, weekend feeds, liquidation limits, berths and what the owner can and cannot do.` });

export default function RulesPage() {
  return (
    <div className="wrap pt-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(breadcrumbLd([{ name: "Rules", path: "/rules" }]))} />
      <span className="band" />
      <h1 className="mt-4 font-display text-[38px] leading-tight font-black sm:text-[48px]" style={{ fontStretch: "118%" }}>
        {BRAND.name} rules
      </h1>
      <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink-2">
        What can go wrong, who carries it, and what nobody at {BRAND.name} can do to your positions. Read these before lending, borrowing or
        shorting.
      </p>
      <ol className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-2">
        {RULES.map((r, i) => (
          <li key={r.title} className="slab p-5 sm:p-6">
            <span className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-slab-3 text-amber">
                <RuleIcon name={r.icon} />
              </span>
              <span className="text-[12.5px] font-semibold text-ink-3">Rule {i + 1}</span>
            </span>
            <h2 className="mt-3 text-[18px] font-semibold">{r.title}</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{r.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
