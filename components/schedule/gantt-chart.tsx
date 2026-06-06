"use client";

import { cn } from "@/lib/utils";
import type { GridLine } from "@/lib/schedule-calc";

export interface GanttBar {
  key: string;
  label: string;
  phase: string;
  startOffset: number;
  finishOffset: number;
  progress?: number;
  isCriticalPath?: boolean;
  needsClientReview?: boolean;
  sub?: string;
}

const PHASE_COLORS = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
];

const LABEL_W = 176; // px

export function GanttChart({
  bars,
  total,
  startLabel,
  gridLines = [],
  pxPerDay,
  editable = false,
  onResize,
}: {
  bars: GanttBar[];
  total: number;
  /** project start date label, shown over the (frozen) task-name column */
  startLabel?: string;
  gridLines?: GridLine[];
  /** pixels per business-day — controls zoom (week view zooms in, scrollable) */
  pxPerDay: number;
  editable?: boolean;
  onResize?: (key: string, newDuration: number) => void;
}) {
  const phases = Array.from(new Set(bars.map((b) => b.phase)));
  const colorOf = (phase: string) =>
    PHASE_COLORS[phases.indexOf(phase) % PHASE_COLORS.length];
  const x = (offset: number) => offset * pxPerDay;
  const chartW = Math.max(1, total) * pxPerDay;
  const hasHoliday = gridLines.some((g) => g.kind === "holiday");
  const hasWeek = gridLines.some((g) => g.kind === "week");

  function startResize(e: React.PointerEvent, bar: GanttBar) {
    if (!editable || !onResize) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const origDur = bar.finishOffset - bar.startOffset;
    const move = (ev: PointerEvent) => {
      const deltaDays = Math.round((ev.clientX - startX) / pxPerDay);
      onResize(bar.key, Math.max(1, origDur + deltaDays));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function gridLineEls() {
    return gridLines.map((g, i) => (
      <div
        key={i}
        title={g.kind === "holiday" ? g.label : undefined}
        className={cn(
          "absolute inset-y-0 w-px",
          g.kind === "month"
            ? "bg-slate-300"
            : g.kind === "holiday"
              ? "bg-rose-400"
              : "bg-slate-200",
        )}
        style={{ left: x(g.offset) }}
      />
    ));
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <div className="w-max p-3">
        {/* timeline header: month band (top) + week labels (bottom) */}
        <div className="mb-1 flex items-stretch">
          <div
            className="sticky left-0 z-20 flex shrink-0 items-end bg-background pr-3"
            style={{ width: LABEL_W }}
          >
            {startLabel && (
              <span className="text-[11px] text-muted-foreground">
                {startLabel} 〜
              </span>
            )}
          </div>
          <div className="relative h-9" style={{ width: chartW }}>
            {gridLines
              .filter((g) => g.kind === "month")
              .map((g, i) => (
                <span
                  key={`m${i}`}
                  className="absolute top-0 whitespace-nowrap border-l border-slate-300 pl-1 text-[11px] font-semibold text-slate-600"
                  style={{ left: x(g.offset) }}
                >
                  {g.label}
                </span>
              ))}
            {gridLines
              .filter((g) => g.kind === "week")
              .map((g, i) => (
                <span
                  key={`w${i}`}
                  className="absolute bottom-0 whitespace-nowrap pl-0.5 text-[9px] text-muted-foreground"
                  style={{ left: x(g.offset) }}
                >
                  {g.label}
                </span>
              ))}
          </div>
        </div>

        {/* rows */}
        <div className="space-y-1.5">
          {bars.map((b) => (
            <div key={b.key} className="flex items-center">
              <div
                className="sticky left-0 z-20 shrink-0 truncate bg-background pr-3 text-xs"
                style={{ width: LABEL_W }}
                title={b.label}
              >
                {b.needsClientReview && (
                  <span className="mr-1 text-amber-600">◆</span>
                )}
                {b.label}
              </div>
              <div
                data-gantt-track
                className="relative h-6 rounded bg-muted/40"
                style={{ width: chartW }}
              >
                {gridLineEls()}
                <div
                  className={cn(
                    "absolute top-0 flex h-6 items-center overflow-visible rounded text-[10px] text-white",
                    colorOf(b.phase),
                    b.isCriticalPath && "ring-2 ring-rose-500 ring-offset-1",
                  )}
                  style={{
                    left: x(b.startOffset),
                    width: Math.max(8, x(b.finishOffset) - x(b.startOffset)),
                  }}
                  title={`${b.label}（${b.sub ?? ""}）`}
                >
                  {b.progress && b.progress > 0 ? (
                    <div
                      className="absolute inset-y-0 left-0 rounded-l bg-black/25"
                      style={{ width: `${b.progress}%` }}
                    />
                  ) : null}
                  <span className="relative z-10 truncate px-1.5">
                    {b.sub ?? b.label}
                  </span>
                  {editable && (
                    <div
                      onPointerDown={(e) => startResize(e, b)}
                      className="absolute top-0 right-0 z-20 h-full w-2 cursor-ew-resize rounded-r bg-white/30 hover:bg-white/60"
                      title="ドラッグで期間を変更"
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* legend */}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          {phases.map((p) => (
            <span key={p} className="flex items-center gap-1">
              <span className={cn("size-2.5 rounded-sm", colorOf(p))} />
              {p}
            </span>
          ))}
          <span className="ml-auto text-muted-foreground">
            {hasWeek ? "細線=週(W) / 太線=月初" : "太線=月初"}
            {hasHoliday && <span className="text-rose-500"> / 赤=祝日・休業</span>}
          </span>
        </div>
      </div>
    </div>
  );
}
