"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark, Mark } from "@/components/Mark";
import { CaTicket } from "@/components/CopyCa";
import { NavWallet } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { APP_TABS, HOME_NAV } from "@/components/site";

/*
 * One header for the site. Marketing pages get the short link row; /app pages get the tab rail under the
 * bar. The wallet dialog is portalled to <body>, so the blurred bar never clips it.
 */
export function SiteHeader() {
  const path = usePathname() ?? "/";
  const inApp = path === "/app" || path.startsWith("/app/");
  const { address } = useWallet();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-night/90 backdrop-blur-md">
      <div className="wrap flex h-16 items-center gap-3" data-testid="navrow">
        <Link href="/" className="flex shrink-0 items-center" aria-label="ONIXS home">
          <span className="hidden sm:inline-flex">
            <Wordmark />
          </span>
          <span className="sm:hidden">
            <Mark size={28} />
          </span>
        </Link>
        {!inApp ? (
          <nav aria-label="Site" className="ml-6 hidden items-center gap-1 lg:flex">
            {HOME_NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-[14.5px] font-medium text-ink-2 hover:text-ink">
                {n.label}
              </Link>
            ))}
          </nav>
        ) : null}
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <CaTicket />
          {inApp || address ? (
            <NavWallet />
          ) : (
            <Link href="/app" className="btn btn-sm">
              Open app
            </Link>
          )}
        </div>
      </div>
      {inApp ? (
        <nav aria-label="App" className="wrap scroll-x flex gap-1 pb-0" data-testid="app-tabs">
          {APP_TABS.map((t) => {
            const active = t.href === "/app" ? path === "/app" : path.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`relative shrink-0 px-3 pt-1.5 pb-3 text-[14.5px] font-medium whitespace-nowrap ${active ? "text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full after:bg-amber" : "text-ink-2 hover:text-ink"}`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      ) : (
        <nav aria-label="Site (small screens)" className="wrap scroll-x flex gap-1 pb-2 lg:hidden">
          {HOME_NAV.map((n) => (
            <Link key={n.href} href={n.href} className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13.5px] font-medium whitespace-nowrap text-ink-2">
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
