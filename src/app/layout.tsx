import type { Metadata, Viewport } from "next";
import { Archivo, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BoardProvider } from "@/components/BoardProvider";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { WalletModalProvider } from "@/components/wallet/WalletButton";
import { BRAND, hasX } from "@/config/brand";
import { HOME_DESCRIPTION, HOME_TITLE, ldJson, siteLd } from "@/lib/seo";

const wide = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-wide", display: "swap" });
const text = Instrument_Sans({ subsets: ["latin"], axes: ["wdth"], variable: "--font-text", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.url),
  title: { default: HOME_TITLE, template: `%s | ${BRAND.name}` },
  description: HOME_DESCRIPTION,
  applicationName: BRAND.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: `${BRAND.name}: ${BRAND.slogan}`,
    description: HOME_DESCRIPTION,
    url: BRAND.url,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    ...(hasX ? { site: BRAND.xHandle, creator: BRAND.xHandle } : {}),
    title: `${BRAND.name}: ${BRAND.slogan}`,
    description: HOME_DESCRIPTION,
  },
};

export const viewport: Viewport = { themeColor: "#0b0e2b", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${wide.variable} ${text.variable}`}>
      <body className="min-h-screen">
        <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(siteLd)} />
        <WalletProvider>
          <WalletModalProvider>
            <BoardProvider>
              <SiteHeader />
              <main>{children}</main>
              <SiteFooter />
            </BoardProvider>
          </WalletModalProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
