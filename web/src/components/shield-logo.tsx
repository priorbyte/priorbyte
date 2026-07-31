/**
 * Priorbyte mark: thin-lined geometric shield, open at the top,
 * with a single glowing cyan dot-eye inside.
 */
export function ShieldLogo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 36"
      fill="none"
      className={className}
      role="img"
      aria-label="Priorbyte"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Shield outline, deliberately open across the top edge. */}
      <path
        d="M2.5 5.5 2.5 18c0 8 6 12.5 13.5 15.5C23.5 30.5 29.5 26 29.5 18V5.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M8.5 9.5 8.5 18c0 4.6 3.3 7.6 7.5 9.4 4.2-1.8 7.5-4.8 7.5-9.4V9.5"
        stroke="currentColor"
        strokeWidth="0.75"
        strokeLinecap="round"
        opacity="0.45"
      />
      <circle cx="16" cy="17" r="2.25" fill="currentColor" className="animate-pulse-eye" />
    </svg>
  );
}
