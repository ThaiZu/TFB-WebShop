// Loyalty icons — set "A · Classique" approved on 27/11/2026:
// Points = starred coin, Bingo = ticked grid, Vouchers = "%" ticket.
// Same line style as the other webshop icons (1.8 px stroke, round caps).
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false' };

export function PointsIcon({ size = 18, className }) {
  return <svg {...base} width={size} height={size} className={className}>
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 7.2l1.45 2.95 3.25.47-2.35 2.29.55 3.24L12 14.62l-2.9 1.53.55-3.24-2.35-2.29 3.25-.47z"/>
  </svg>;
}

export function BingoIcon({ size = 18, className }) {
  return <svg {...base} width={size} height={size} className={className}>
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>
    <path d="M4.8 5.2l2.4 2.4M10.8 11.2l2.4 2.4M16.8 17.2l2.4 2.4" strokeWidth="2.2"/>
  </svg>;
}

export function VoucherIcon({ size = 18, className }) {
  return <svg {...base} width={size} height={size} className={className}>
    <path d="M3 7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4z"/>
    <path d="M9.5 14.5l5-5"/><circle cx="9.5" cy="9.8" r=".9"/><circle cx="14.5" cy="14.2" r=".9"/>
  </svg>;
}

// Small glyphs for history rows: purchase (bag), bingo, return (arrow back).
export function SourceIcon({ source, size = 18 }) {
  if (source === 'BINGO') return <BingoIcon size={size}/>;
  if (source === 'RETURN') return <svg {...base} width={size} height={size}><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>;
  return <svg {...base} width={size} height={size}><path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>;
}
