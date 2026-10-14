/** Half-dial of how much of a limit is used: jade, then amber, then rose near the edge. */
export function Gauge({ used, label = "of the room used" }: { used: number | null; label?: string }) {
  const v = used === null || !Number.isFinite(used) ? 0 : Math.max(0, Math.min(1, used));
  const angle = Math.PI * (1 - v);
  const x = 100 + 78 * Math.cos(angle);
  const y = 100 - 78 * Math.sin(angle);
  return (
    <div className="flex flex-col items-center" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}>
      <svg viewBox="0 0 200 112" width="210" height="118" aria-hidden="true">
        <path d="M22 100a78 78 0 0 1 113.5-69.5" fill="none" stroke="#3fe0b5" strokeWidth="12" strokeLinecap="round" />
        <path d="M135.5 30.5A78 78 0 0 1 170 62" fill="none" stroke="#ffd83a" strokeWidth="12" />
        <path d="M170 62a78 78 0 0 1 8 38" fill="none" stroke="#ff4f9a" strokeWidth="12" strokeLinecap="round" />
        <line x1="100" y1="100" x2={x} y2={y} stroke="#eef0ff" strokeWidth="3" strokeLinecap="round" />
        <circle cx="100" cy="100" r="7" fill="#eef0ff" />
        <circle cx="100" cy="100" r="3" fill="#ff4f9a" />
      </svg>
      <b className="font-display text-[30px] leading-none font-black" style={{ fontStretch: "110%" }}>
        {used === null ? "0%" : `${Math.round(v * 100)}%`}
      </b>
      <span className="mt-1 text-[13px] text-ink-3">{label}</span>
    </div>
  );
}
