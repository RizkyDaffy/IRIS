type LogoProps = { className?: string; size?: "sm" | "md" | "lg" };
export function Logo({ className = "", size = "md" }: LogoProps) {
  const dims = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-8 w-8" : "h-11 w-11";
  const title = size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-2xl";
  const sub = size === "lg" ? "text-base -mt-1" : size === "sm" ? "text-[10px]" : "text-sm -mt-0.5";
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg viewBox="0 0 40 40" className={dims} aria-hidden="true">
        <g fill="none" stroke="var(--color-brand)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="20" cy="20" r="4.5" fill="var(--color-brand)" />
          <circle cx="8" cy="10" r="2.8" />
          <circle cx="32" cy="10" r="2.8" />
          <circle cx="8" cy="30" r="2.8" />
          <circle cx="32" cy="30" r="2.8" />
          <path d="M10.2 11.6 17 18M29.8 11.6 23 18M10.2 28.4 17 22M29.8 28.4 23 22" />
        </g>
      </svg>
      <div className="leading-none">
        <div className={`${title} font-extrabold text-brand tracking-tight`}>Enterprise</div>
        <div className={`${sub} font-semibold text-foreground/80 tracking-wide`}>API Hub</div>
      </div>
    </div>
  );
}
