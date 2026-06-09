"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Maximize2,
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WireframeView } from "@/components/design/wireframe-view";
import { buildFlowLayout, type FlowEdge } from "@/lib/diagram/flow-layout";
import type { WireframeBlock } from "@/lib/ai/providers";

/**
 * Figma风 screen-flow canvas: each node IS the screen's wireframe thumbnail,
 * wired together with smooth connectors + trigger pills on a soft dotted board.
 * Deterministic HTML/SVG (no design tool, no browser-only deps).
 */

const ACCENT = "#264bf1";

// zoom bounds (module-scoped so effect closures stay stable)
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export interface FlowScreen {
  key: string;
  name: string;
  role?: string;
  wireframe: WireframeBlock[];
}
export interface FlowTransition {
  from: string;
  to: string;
  label?: string;
}

function edgePath(e: FlowEdge): string {
  const { x1, y1, x2, y2, dir } = e;
  if (dir === "forward") {
    const dx = Math.max(24, Math.min(90, (x2 - x1) * 0.5));
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  }
  if (dir === "back") {
    // loop back to an earlier column: bow downward to the left
    const dx = 64;
    const bow = Math.max(Math.abs(y2 - y1) * 0.4, 40);
    return `M ${x1} ${y1} C ${x1 - dx} ${y1 + bow}, ${x2 + dx} ${y2 + bow}, ${x2} ${y2}`;
  }
  // same column: bow out to the right
  const dx = 56;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 + dx} ${y2}, ${x2} ${y2}`;
}

function labelPoint(e: FlowEdge): { x: number; y: number } {
  if (e.dir === "forward") {
    return { x: (e.x1 + e.x2) / 2, y: (e.y1 + e.y2) / 2 - 10 };
  }
  if (e.dir === "back") {
    return { x: (e.x1 + e.x2) / 2, y: Math.max(e.y1, e.y2) + 30 };
  }
  return { x: Math.max(e.x1, e.x2) + 34, y: (e.y1 + e.y2) / 2 };
}

export function ScreenFlow({
  screens,
  transitions,
}: {
  screens: FlowScreen[];
  transitions: FlowTransition[];
}) {
  const layout = buildFlowLayout(
    screens.map((s) => ({ key: s.key, name: s.name, role: s.role })),
    transitions,
  );
  const wfByKey = new Map(screens.map((s) => [s.key, s.wireframe]));
  const markerId = "flow-arrow";
  const [open, setOpen] = useState<FlowScreen | null>(null);
  const SCALE = 2.3;

  // ---- Figma风 zoom / pan ----
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const pan = useRef<{
    active: boolean;
    x: number;
    y: number;
    sl: number;
    st: number;
  }>({ active: false, x: 0, y: 0, sl: 0, st: 0 });

  const zoomBy = useCallback(
    (f: number) => setZoom((z) => clampZoom(z * f)),
    [],
  );
  const fit = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setZoom(clampZoom((el.clientWidth - 24) / layout.width));
  }, [layout.width]);

  // ---- trackpad pinch-to-zoom (macOS) ----
  // A pinch gesture is delivered to the browser as a wheel event with ctrlKey
  // set (⌘/Ctrl + wheel works too). Plain two-finger scroll has no modifier and
  // keeps panning via the container's native overflow. React's onWheel is
  // passive, so we attach a native non-passive listener to call preventDefault
  // (otherwise the browser zooms the whole page). Deltas are coalesced per
  // animation frame, and we re-anchor scroll so the point under the cursor stays
  // fixed — Figma-style zoom-to-cursor.
  const zoomRef = useRef(1);
  const anchor = useRef<{ cx: number; cy: number; ox: number; oy: number } | null>(
    null,
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    let accum = 0;
    let clientX = 0;
    let clientY = 0;
    const apply = () => {
      raf = 0;
      const dy = accum;
      accum = 0;
      const old = zoomRef.current;
      const next = clampZoom(old * Math.exp(-dy * 0.0125));
      if (next === old) return;
      const rect = el.getBoundingClientRect();
      const ox = clientX - rect.left;
      const oy = clientY - rect.top;
      anchor.current = {
        cx: (el.scrollLeft + ox) / old,
        cy: (el.scrollTop + oy) / old,
        ox,
        oy,
      };
      setZoom(next);
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // plain scroll → pan, don't intercept
      e.preventDefault();
      accum += e.deltaY;
      clientX = e.clientX;
      clientY = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // After a zoom change, keep the cursor's content point fixed and sync the ref.
  useLayoutEffect(() => {
    zoomRef.current = zoom;
    const a = anchor.current;
    const el = scrollRef.current;
    if (!a || !el) return;
    el.scrollLeft = a.cx * zoom - a.ox;
    el.scrollTop = a.cy * zoom - a.oy;
    anchor.current = null;
  }, [zoom]);

  function onPointerDown(e: React.PointerEvent) {
    // pan only when grabbing empty canvas (not a screen node)
    if ((e.target as HTMLElement).closest("[data-flow-node]")) return;
    const el = scrollRef.current;
    if (!el) return;
    pan.current = {
      active: true,
      x: e.clientX,
      y: e.clientY,
      sl: el.scrollLeft,
      st: el.scrollTop,
    };
    el.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!pan.current.active) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = pan.current.sl - (e.clientX - pan.current.x);
    el.scrollTop = pan.current.st - (e.clientY - pan.current.y);
  }
  function endPan(e: React.PointerEvent) {
    pan.current.active = false;
    scrollRef.current?.releasePointerCapture(e.pointerId);
  }

  return (
    <div className="relative">
      {/* zoom toolbar */}
      <div className="absolute right-2 top-2 z-20 flex items-center gap-0.5 rounded-lg border bg-white/95 p-0.5 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.2)}
          title="縮小"
          className="rounded-md p-1.5 text-slate-600 hover:bg-muted"
        >
          <ZoomOut className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          title="100%にリセット"
          className="min-w-12 rounded-md px-1 py-1 text-center text-xs font-medium text-slate-700 tabular-nums hover:bg-muted"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1.2)}
          title="拡大"
          className="rounded-md p-1.5 text-slate-600 hover:bg-muted"
        >
          <ZoomIn className="size-4" />
        </button>
        <span className="mx-0.5 h-4 w-px bg-slate-200" />
        <button
          type="button"
          onClick={fit}
          title="幅に合わせる"
          className="rounded-md p-1.5 text-slate-600 hover:bg-muted"
        >
          <Maximize className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          title="リセット"
          className="rounded-md p-1.5 text-slate-600 hover:bg-muted"
        >
          <RotateCcw className="size-4" />
        </button>
      </div>

      <div
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        className="h-[600px] cursor-grab overflow-auto rounded-xl border bg-slate-50/70 active:cursor-grabbing"
        style={{
          backgroundImage:
            "radial-gradient(circle, #d3d9ec 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        {/* sizer reserves scaled space so scrollbars track zoom */}
        <div
          style={{
            width: layout.width * zoom,
            height: layout.height * zoom,
          }}
        >
          <div
            className="relative origin-top-left"
            style={{
              width: layout.width,
              height: layout.height,
              transform: `scale(${zoom})`,
            }}
          >
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
          {layout.edges.map((e, i) => (
            <path
              key={i}
              d={edgePath(e)}
              fill="none"
              stroke={ACCENT}
              strokeWidth={1.8}
              strokeLinecap="round"
              markerEnd={`url(#${markerId})`}
              opacity={0.85}
            />
          ))}
          {/* trigger labels as pills (foreignObject auto-sizes) */}
          {layout.edges.map((e, i) => {
            if (!e.label) return null;
            const p = labelPoint(e);
            return (
              <foreignObject
                key={`l${i}`}
                x={p.x - 90}
                y={p.y - 11}
                width={180}
                height={22}
                style={{ overflow: "visible" }}
              >
                <div className="flex justify-center">
                  <span className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm">
                    {e.label}
                  </span>
                </div>
              </foreignObject>
            );
          })}
        </svg>

        {/* screen nodes = wireframes (click to enlarge) */}
        {layout.nodes.map((n) => {
          const wf = wfByKey.get(n.key) ?? [];
          return (
            <div
              key={n.key}
              data-flow-node
              className="absolute"
              style={{ left: n.x, top: n.y, width: n.w }}
            >
              {n.isStart && (
                <span
                  className="absolute -top-2.5 left-2 z-10 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white shadow"
                  style={{ background: ACCENT }}
                >
                  開始
                </span>
              )}
              <button
                type="button"
                onClick={() =>
                  setOpen({
                    key: n.key,
                    name: n.name,
                    role: n.role,
                    wireframe: wf,
                  })
                }
                title={`${n.name} を拡大表示`}
                className="group relative block w-full rounded-lg text-left ring-1 ring-slate-200 transition-all hover:ring-2 hover:ring-[#264bf1]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#264bf1]"
              >
                <span className="absolute right-1.5 top-1.5 z-10 hidden rounded-md bg-white/90 p-1 text-slate-500 shadow-sm ring-1 ring-slate-200 group-hover:block">
                  <Maximize2 className="size-3" />
                </span>
                <WireframeView
                  name={n.name}
                  role={n.role}
                  blocks={
                    wf.length ? wf : [{ kind: "text", label: "（UI未設計）" }]
                  }
                />
              </button>
            </div>
          );
        })}
          </div>
        </div>
      </div>

      {/* enlarge modal */}
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {open?.name}
              {open?.role && (
                <span className="text-xs font-normal text-muted-foreground">
                  · {open.role}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {open && (
            <div className="overflow-auto">
              <div
                className="relative mx-auto"
                style={{ width: 248 * SCALE, height: 216 * SCALE }}
              >
                <div
                  className="absolute left-1/2 top-1/2"
                  style={{
                    transform: `translate(-50%, -50%) scale(${SCALE})`,
                    transformOrigin: "center",
                  }}
                >
                  <div style={{ width: 248 }}>
                    <WireframeView
                      name={open.name}
                      role={open.role}
                      blocks={
                        open.wireframe.length
                          ? open.wireframe
                          : [{ kind: "text", label: "（UI未設計）" }]
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
