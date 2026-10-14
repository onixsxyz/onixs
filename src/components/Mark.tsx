/*
 * The ONIXS mark: an onyx stone cut as a hexagon, banded in the three stripe colours.
 * Inline SVG so it stays sharp at every size; the raster set in src/app is made from the same shape
 * by ../referensi/tools/make-brand.mjs.
 */
export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <defs>
        <clipPath id="onixs-hex">
          <path d="M32 3 57 17.5v29L32 61 7 46.5v-29Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#onixs-hex)">
        <rect width="64" height="64" fill="#0b0e2b" />
        <rect y="15" width="64" height="7" fill="#ff4f9a" />
        <rect y="28.5" width="64" height="7" fill="#ffd83a" />
        <rect y="42" width="64" height="7" fill="#3fe0b5" />
      </g>
      <path d="M32 3 57 17.5v29L32 61 7 46.5v-29Z" fill="none" stroke="#eef0ff" strokeWidth="3.5" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mark size={size} />
      <span className="font-display text-[19px] font-black tracking-tight" style={{ fontStretch: "125%" }}>
        ONIXS
      </span>
    </span>
  );
}
