/** The Outagekit mark: a runtime dial around a lightning bolt. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="15" fill="#0b1220" />
      <circle cx="32" cy="32" r="20" fill="none" stroke="#23304a" strokeWidth="7" />
      <path
        d="M32 12a20 20 0 1 1-19.02 13.82"
        fill="none"
        stroke="#f5a524"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path d="M34.5 20 25 34h6.5l-2 10L39 30h-6.5l2-10Z" fill="#ffffff" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <LogoMark size={30} />
      <span>
        Outage<span className="wordmark-kit">kit</span>
      </span>
    </span>
  );
}
