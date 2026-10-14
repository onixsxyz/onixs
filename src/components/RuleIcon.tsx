import type { Rule } from "@/content/rules";

const PATHS: Record<Rule["icon"], string> = {
  gap: "M3 17l5-5 4 3 6-8M15 7h4v4",
  loss: "M12 3v18M6 9l6-6 6 6",
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  queue: "M4 6h16M4 12h10M4 18h6",
  credit: "M3 7h18v10H3zM3 11h18M7 15h3",
  lever: "M4 20h16M7 16l4-6 3 3 5-8",
  berth: "M4 10l8-6 8 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM9 20v-6h6v6",
  owner: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z",
  issuer: "M5 21V8l7-5 7 5v13M9 21v-5h6v5M9 11h.01M15 11h.01",
  coin: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 9h4.5a1.5 1.5 0 0 1 0 3H9h5a1.5 1.5 0 0 1 0 3H9V9z",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  pool: "M3 15c3 0 3-2 6-2s3 2 6 2 3-2 6-2M3 19c3 0 3-2 6-2s3 2 6 2 3-2 6-2M12 3v7",
};

export function RuleIcon({ name }: { name: Rule["icon"] }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
