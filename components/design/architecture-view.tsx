import { buildArchitectureLayout } from "@/lib/diagram/arch-layout";
import type { GeneratedArchitecture } from "@/lib/ai/providers";

/**
 * Refined system-architecture board: layer bands with rounded component cards
 * and subtle brand connectors on the same dotted canvas as the screen-flow, so
 * the 画面設計 tab feels consistent. Deterministic HTML/SVG (no browser deps).
 * Exports keep using the schematic scene (lib/diagram/scene.ts).
 */

const ACCENT = "#264bf1";

export function ArchitectureView({
  architecture,
}: {
  architecture: GeneratedArchitecture;
}) {
  const layout = buildArchitectureLayout(architecture);
  if (layout.nodes.length === 0) return null;
  const markerId = "arch-arrow";

  return (
    <div className="overflow-auto rounded-xl border bg-slate-50/70">
      <div
        className="relative mx-auto"
        style={{
          width: layout.width,
          height: layout.height,
          backgroundImage:
            "radial-gradient(circle, #d3d9ec 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          backgroundPosition: "12px 12px",
        }}
      >
        {/* layer bands + left labels */}
        {layout.bands.map((b, i) => (
          <div key={`band-${i}`}>
            <div
              className="absolute rounded-xl border border-slate-200/70 bg-white/45"
              style={{
                left: 12,
                top: b.y,
                width: layout.width - 24,
                height: b.h,
              }}
            />
            <div
              className="absolute flex items-center"
              style={{ left: 20, top: b.y, height: b.h, width: layout.labelW - 16 }}
            >
              <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
                {b.name}
              </span>
            </div>
          </div>
        ))}

        {/* connectors */}
        <svg
          className="pointer-events-none absolute inset-0"
          width={layout.width}
          height={layout.height}
        >
          <defs>
            <marker
              id={markerId}
              markerWidth="10"
              markerHeight="10"
              refX="7.5"
              refY="3"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0,0 L7.5,3 L0,6 Z" fill={ACCENT} />
            </marker>
          </defs>
          {layout.edges.map((e, i) => {
            const my = (e.y1 + e.y2) / 2;
            return (
              <path
                key={i}
                d={`M ${e.x1} ${e.y1} C ${e.x1} ${my}, ${e.x2} ${my}, ${e.x2} ${e.y2}`}
                fill="none"
                stroke={ACCENT}
                strokeWidth={1.6}
                strokeLinecap="round"
                markerEnd={`url(#${markerId})`}
                opacity={0.7}
              />
            );
          })}
        </svg>

        {/* component cards */}
        {layout.nodes.map((n, i) => (
          <div
            key={`${n.name}-${i}`}
            className="absolute flex flex-col justify-center overflow-hidden rounded-lg border border-slate-200 bg-white px-3 shadow-sm"
            style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
          >
            <span
              className="absolute inset-y-0 left-0 w-1"
              style={{ background: ACCENT }}
            />
            <p className="truncate text-sm font-semibold text-slate-800">
              {n.name}
            </p>
            {n.note && (
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-tight text-slate-500">
                {n.note}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
