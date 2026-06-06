import { cn } from "@/lib/utils";

/** AIdeaLab brand blue. */
export const AIDEALAB_BLUE = "#3D5AFE";

/**
 * AIdeaLab logo mark — four blue shapes on a 45°-rotated grid (rounded square,
 * droplet, capsule, dot). Recreated as scalable SVG so it stays crisp and
 * inherits `currentColor`. Set width/height via className (e.g. `size-8`).
 */
export function AIdeaLabMark({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 128 128"
      className={cn("text-[#3D5AFE]", className)}
      style={style}
      role="img"
      aria-label="AIdeaLab"
      fill="currentColor"
    >
      <g transform="rotate(45 64 64)">
        {/* large rounded square */}
        <rect x="16" y="16" width="52" height="52" rx="14" />
        {/* droplet (upper-right) — round body, pointed top */}
        <path d="M96 28 C 84 40 84 46 84 50 a12 12 0 1 0 24 0 C 108 46 108 40 96 28 Z" />
        {/* long capsule (lower-left) */}
        <rect x="16" y="80" width="68" height="28" rx="14" />
        {/* small dot (lower-right) */}
        <circle cx="98" cy="94" r="9" />
      </g>
    </svg>
  );
}

/** Full lockup: mark + "AIdeaLab" wordmark. */
export function AIdeaLabLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <AIdeaLabMark className="size-7 shrink-0" />
      <span
        className="text-lg font-extrabold tracking-tight"
        style={{ color: AIDEALAB_BLUE }}
      >
        AIdeaLab
      </span>
    </span>
  );
}
