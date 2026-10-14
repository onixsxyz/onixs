"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { BRAND, TOKEN, isAddress, shortAddress } from "@/config/brand";

/*
 * The $ONIXS contract address in three shapes, all from BRAND.ca: a ticket in the navbar ("CA" on phones),
 * a full strip in the footer and a large card on the token page. While the address is a placeholder every
 * shape says "At launch" and nothing can be copied.
 */

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!isAddress(BRAND.ca)) return;
    try {
      await navigator.clipboard.writeText(BRAND.ca);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard refused: the address stays readable on the token page.
    }
  };
  return { copied, copy, live: isAddress(BRAND.ca) };
}

/** Navbar ticket: "$ONIXS 0x12…abcd" with a copy notch; a short "CA" stub below sm. */
export function CaTicket() {
  const { copied, copy, live } = useCopy();
  return (
    <button
      type="button"
      onClick={copy}
      disabled={!live}
      title={live ? `Copy the ${BRAND.symbol} contract address` : `${BRAND.symbol} contract address is published at launch`}
      className="group inline-flex h-[34px] items-center overflow-hidden rounded-lg border border-line-2 text-[12.5px] enabled:hover:border-amber/60 disabled:cursor-not-allowed"
      data-testid="ca-ticket"
    >
      <span className="flex h-full items-center bg-lilac px-2 font-bold text-night">CA</span>
      <span className="hidden h-full items-center gap-1.5 px-2.5 sm:flex">
        <span className="font-semibold text-ink">{BRAND.symbol}</span>
        <span className="text-ink-3">{live ? shortAddress(BRAND.ca, 5, 4) : "At launch"}</span>
      </span>
      <span className="flex h-full items-center border-l border-dashed border-line-2 px-2 text-ink-2">
        {copied ? <Check size={13} className="text-jade" /> : <Copy size={13} />}
      </span>
    </button>
  );
}

/** Footer and token page: the full address with copy and explorer links. */
export function CaStrip({ large = false }: { large?: boolean }) {
  const { copied, copy, live } = useCopy();
  return (
    <div className={`slab flex flex-col gap-3 ${large ? "p-5 sm:p-6" : "p-4"}`} data-testid="ca-strip">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="ticker" data-tone="amber">{BRAND.symbol} CA</span>
        <span className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-sm btn-line" onClick={copy} disabled={!live} data-testid="ca-copy">
            {copied ? <Check size={13} /> : <Copy size={13} />} {live ? (copied ? "Copied" : "Copy") : "At launch"}
          </button>
          {TOKEN.explorerUrl ? (
            <a className="btn btn-sm btn-line" href={TOKEN.explorerUrl} target="_blank" rel="noreferrer">
              Explorer
            </a>
          ) : null}
          {TOKEN.ponsUrl ? (
            <a className="btn btn-sm btn-line" href={TOKEN.ponsUrl} target="_blank" rel="noreferrer">
              Pons
            </a>
          ) : null}
        </span>
      </div>
      <code className={`block rounded-lg bg-night-2 px-3 py-2.5 font-mono text-ink ${live ? "break-all" : "break-words"} ${large ? "text-[15px]" : "text-[13px]"}`}>
        {live ? BRAND.ca : "Contract address coming soon: it is posted here, on X and nowhere else."}
      </code>
    </div>
  );
}
