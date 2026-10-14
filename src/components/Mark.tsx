/*
 * The ONIXS mark: the owner's lavender tile with the navy ring and star (public/brand/mark.webp, trimmed from
 * ../referensi/ONIXS_PNG.png by ../referensi/tools/make-brand.mjs). Plain <img>: next/image renders blank at icon sizes.
 */
export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return <img src="/brand/mark.webp" alt="" width={size} height={size} className={`shrink-0 rounded-[22%] ${className}`} style={{ width: size, height: size }} />;
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
