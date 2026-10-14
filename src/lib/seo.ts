import type { Metadata } from "next";
import { BRAND, CHAIN, hasGithub, hasX } from "@/config/brand";

export const HOME_TITLE = `${BRAND.name} | ${BRAND.slogan.replace(/\.$/, "")}`;
export const HOME_DESCRIPTION =
  `${BRAND.name} is a stock token lending protocol on ${BRAND.chainName}. Lend SPY, QQQ or NVDA tokens for rent paid by shorts, borrow USDG, or short in one step.`;

/**
 * Per-route metadata in one shape: a unique title, a description written for
 * the search result, a canonical URL on the production domain, and matching
 * Open Graph / X cards. The share image comes from the opengraph-image and
 * twitter-image files in src/app, which every route inherits.
 */
export function pageMeta({
  path,
  title,
  description,
  noindex = false,
  type = "website",
}: {
  path: string;
  title: string;
  description: string;
  noindex?: boolean;
  type?: "website" | "article";
}): Metadata {
  const url = `${BRAND.url}${path === "/" ? "" : path}`;
  // Child routes that set openGraph replace the inherited file-based image, so name it explicitly.
  const images = [{ url: "/opengraph-image.jpg", width: 1200, height: 630, alt: `${BRAND.name}: ${BRAND.slogan}` }];
  return {
    // Every page names the brand once: "Docs | ONIXS"; titles that already carry it stay as written.
    title: { absolute: title.includes(BRAND.name) ? title : `${title} | ${BRAND.name}` },
    description,
    alternates: { canonical: url },
    openGraph: { type, url, siteName: BRAND.name, title: title.includes(BRAND.name) ? title : `${title} | ${BRAND.name}`, description, locale: "en_US", images },
    twitter: { card: "summary_large_image", ...(hasX ? { site: BRAND.xHandle, creator: BRAND.xHandle } : {}), title, description, images: ["/twitter-image.jpg"] },
    robots: noindex ? { index: false, follow: true } : undefined,
  };
}

export type Crumb = { name: string; path: string };

export function breadcrumbLd(trail: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...trail].map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${BRAND.url}${c.path === "/" ? "" : c.path}`,
    })),
  };
}

export function faqLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
  };
}

export const siteLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BRAND.url}/#org`,
    name: BRAND.name,
    url: BRAND.url,
    logo: `${BRAND.url}/icon.png`,
    // Only real profiles: the GitHub link joins once the public repository exists.
    sameAs: [...(hasX ? [BRAND.x] : []), ...(hasGithub ? [BRAND.github] : [])],
    description: HOME_DESCRIPTION,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BRAND.url}/#site`,
    name: BRAND.name,
    url: BRAND.url,
    inLanguage: "en",
    publisher: { "@id": `${BRAND.url}/#org` },
  },
];

export const appLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: BRAND.name,
  url: `${BRAND.url}/app`,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Any (web browser with an EVM wallet)",
  description: `Lend stock tokens, borrow USDG against them, short or leverage SPY, QQQ and NVDA on Morpho markets on ${CHAIN.name}.`,
  publisher: { "@id": `${BRAND.url}/#org` },
};

/** Serialise JSON-LD for a script tag; "<" is escaped so a value can never close the tag. */
export function ldJson(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
