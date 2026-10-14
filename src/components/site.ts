/** Navigation, shared by the header, the app tabs, the footer and the sitemap. */

export const HOME_NAV = [
  { href: "/#desks", label: "Desks" },
  { href: "/app", label: "Markets" },
  { href: "/#chain", label: "Chain data" },
  { href: "/rules", label: "Rules" },
  { href: "/docs", label: "Docs" },
];

export const APP_TABS = [
  { href: "/app", label: "Markets" },
  { href: "/app/lend", label: "Lend" },
  { href: "/app/borrow", label: "Borrow" },
  { href: "/app/short", label: "Short" },
  { href: "/app/pairs", label: "Pairs" },
  { href: "/app/after-hours", label: "After hours" },
  { href: "/app/positions", label: "Positions" },
  { href: "/app/rewards", label: "Rewards" },
  { href: "/app/verify", label: "Verify" },
];

export const FOOT_LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/rules", label: "Rules" },
  { href: "/token", label: "Token" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

/** Indexable routes for the sitemap (the /app tabs are tools and stay noindex). */
export const SITEMAP_ROUTES = ["/", "/docs", "/rules", "/token", "/terms", "/privacy"];
