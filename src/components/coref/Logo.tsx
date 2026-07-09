export function CorefLogo({ inverted = false }: { inverted?: boolean }) {
  const navy = inverted ? "#FFFFFF" : "#0D3B6E";
  const ocean = "#4DA8DA";
  const green = "#2E8B3A";
  return (
    <div className="flex items-center gap-2.5">
      <svg width="38" height="32" viewBox="0 0 48 40" fill="none" aria-hidden>
        {/* hull */}
        <path d="M4 24 L44 24 L40 32 L8 32 Z" fill={navy} />
        {/* deck structure */}
        <rect x="14" y="14" width="10" height="10" fill={navy} />
        <rect x="26" y="10" width="6" height="14" fill={navy} />
        <rect x="34" y="16" width="4" height="8" fill={navy} />
        {/* waves */}
        <path d="M2 34 Q8 30 14 34 T26 34 T38 34 T48 34" stroke={ocean} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M0 38 Q6 35 12 38 T24 38 T36 38 T48 38" stroke={ocean} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7" />
      </svg>
      <div className="leading-none">
        <div className="font-display text-[22px] font-extrabold tracking-tight" style={{ color: navy }}>
          C<span style={{ color: green }}>O</span>REF
        </div>
        <div className="font-mono-data text-[9px] uppercase tracking-[0.18em]" style={{ color: inverted ? "rgba(255,255,255,0.7)" : "#6B7E8F" }}>
          Logistics & Automation
        </div>
      </div>
    </div>
  );
}
