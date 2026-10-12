/** Small cricket icons drawn as inline SVG (no external assets). */
type P = { className?: string };

export function BallIcon({ className = "h-6 w-6" }: P) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="#B3202A" />
      <circle cx="16" cy="16" r="14" fill="url(#ballShine)" />
      <path d="M5.5 9.5c4 3 4 10 0 13M26.5 9.5c-4 3-4 10 0 13" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="1.2 2.2" />
      <path d="M8 5.5c5 5.5 5 15.5 0 21M24 5.5c-5 5.5-5 15.5 0 21" fill="none" stroke="#F5D7A1" strokeWidth="0.8" opacity=".55" />
      <defs>
        <radialGradient id="ballShine" cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor="#fff" stopOpacity=".35" />
          <stop offset="1" stopColor="#000" stopOpacity=".25" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export function BatIcon({ className = "h-6 w-6" }: P) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M21 3l8 8-12.5 12.5-8-8z" fill="#E7C27D" stroke="#9A6B2F" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M9 16l7 7-3.2 3.2a2.2 2.2 0 01-3.1 0l-3.9-3.9a2.2 2.2 0 010-3.1z" fill="#3B2A1A" />
      <path d="M13.5 11.5l7 7" stroke="#9A6B2F" strokeWidth="1" opacity=".6" />
    </svg>
  );
}

export function StumpsIcon({ className = "h-6 w-6" }: P) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <g fill="#E7C27D" stroke="#9A6B2F" strokeWidth="1">
        <rect x="8" y="9" width="3" height="19" rx="1" />
        <rect x="14.5" y="9" width="3" height="19" rx="1" />
        <rect x="21" y="9" width="3" height="19" rx="1" />
      </g>
      <g fill="#C9A15A" stroke="#9A6B2F" strokeWidth="1">
        <rect x="9.5" y="6" width="6" height="2.2" rx="1" />
        <rect x="16.5" y="6" width="6" height="2.2" rx="1" />
      </g>
    </svg>
  );
}

export function GlovesIcon({ className = "h-6 w-6" }: P) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M9 14V7a2 2 0 014 0v5m0-1V5a2 2 0 014 0v6m0-1V6a2 2 0 014 0v7m0-1a2 2 0 014 0v8a8 8 0 01-8 8h-1a8 8 0 01-8-8v-3a2 2 0 014 0z" fill="#F7F3EA" stroke="#475569" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M11 24h10" stroke="#B3202A" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function TrophyIcon({ className = "h-6 w-6" }: P) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M9 5h14v7a7 7 0 01-14 0z" fill="#F5A623" stroke="#B9770E" strokeWidth="1.2" />
      <path d="M9 7H5a4 4 0 004 5M23 7h4a4 4 0 01-4 5" fill="none" stroke="#B9770E" strokeWidth="1.5" />
      <path d="M16 19v4M11 27h10M13 23h6v4h-6z" fill="#F5A623" stroke="#B9770E" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

export function RoleIcon({ role, className = "h-4 w-4" }: { role: string; className?: string }) {
  if (role === "WK") return <GlovesIcon className={className} />;
  if (role === "BOWL") return <BallIcon className={className} />;
  if (role === "AR") return <StumpsIcon className={className} />;
  return <BatIcon className={className} />;
}

export const ROLE_LABEL: Record<string, string> = { WK: "Wicketkeeper", BAT: "Batter", AR: "All-rounder", BOWL: "Bowler" };

export function LockIcon({ className = "h-5 w-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="10" rx="2.2" fill="#64748B" />
      <path d="M8.2 10.5V8a3.8 3.8 0 017.6 0v2.5" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="15.4" r="1.5" fill="#fff" />
    </svg>
  );
}
