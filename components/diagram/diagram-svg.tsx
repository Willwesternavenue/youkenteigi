import type { DiagramScene } from "@/lib/diagram/scene";
import { SLIDE_THEME as T } from "@/lib/slides/theme";

/**
 * SVG renderer for a DiagramScene (screen flow or architecture). Responsive via
 * viewBox; brand-colored. Shares its scene with the PDF/PPTX exporters.
 */
export function DiagramSvg({
  scene,
  ariaLabel,
  fit = "fill",
}: {
  scene: DiagramScene;
  ariaLabel?: string;
  fit?: "fill" | "contain";
}) {
  const markerId = `arrow-${Math.round(scene.width)}x${Math.round(scene.height)}`;
  const style: React.CSSProperties =
    fit === "contain"
      ? { maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", display: "block", background: T.bg }
      : { width: "100%", height: "auto", display: "block", background: T.bg };
  return (
    <svg
      viewBox={`0 0 ${scene.width} ${scene.height}`}
      role="img"
      aria-label={ariaLabel}
      style={style}
      fontFamily="var(--font-sans), sans-serif"
    >
      <defs>
        <marker
          id={markerId}
          markerWidth="9"
          markerHeight="9"
          refX="7"
          refY="3"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L7,3 L0,6 Z" fill={T.textMuted} />
        </marker>
      </defs>

      {scene.arrows.map((a, idx) => {
        const mx = (a.x1 + a.x2) / 2;
        const my = (a.y1 + a.y2) / 2;
        return (
          <g key={`a${idx}`}>
            <line
              x1={a.x1}
              y1={a.y1}
              x2={a.x2}
              y2={a.y2}
              stroke={T.textMuted}
              strokeWidth={1.4}
              markerEnd={`url(#${markerId})`}
            />
            {a.label && (
              <text
                x={mx}
                y={my - 3}
                fontSize={10}
                fill={T.textMuted}
                textAnchor="middle"
                style={{ paintOrder: "stroke", stroke: T.bg, strokeWidth: 3 }}
              >
                {a.label}
              </text>
            )}
          </g>
        );
      })}

      {scene.boxes.map((b) => {
        const emphasis = b.emphasis;
        const fill = emphasis ? T.blue : T.bgSoft;
        const textColor = emphasis ? "#ffffff" : T.text;
        const titleSize = Math.max(
          8,
          Math.min(13, (b.w * 0.86) / Math.max(1, b.title.length)),
        );
        const subSize = b.subtitle
          ? Math.max(7, Math.min(10, (b.w * 0.9) / b.subtitle.length))
          : 10;
        return (
          <g key={b.id}>
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx={8}
              fill={fill}
              stroke={emphasis ? T.blue : T.border}
              strokeWidth={1}
            />
            {!emphasis && (
              <rect x={b.x} y={b.y} width={b.w} height={4} rx={2} fill={T.blue} />
            )}
            <text
              x={b.x + b.w / 2}
              y={b.subtitle ? b.y + b.h / 2 - 2 : b.y + b.h / 2 + 4}
              fontSize={titleSize}
              fontWeight={700}
              fill={textColor}
              textAnchor="middle"
            >
              {b.title}
            </text>
            {b.subtitle && (
              <text
                x={b.x + b.w / 2}
                y={b.y + b.h / 2 + 14}
                fontSize={subSize}
                fill={emphasis ? "#dbe2ff" : T.textMuted}
                textAnchor="middle"
              >
                {b.subtitle}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
