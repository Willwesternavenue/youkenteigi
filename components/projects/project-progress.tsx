import Link from "next/link";
import { Check, ArrowRight, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectProgress as Progress } from "@/lib/project-progress";

/** Compact workflow progress bar + clickable stepper + "next action" CTA. */
export function ProjectProgress({ progress }: { progress: Progress }) {
  const { steps, doneCount, total, percent, next } = progress;

  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-medium">
            進捗 <span className="tabular-nums">{doneCount}/{total}</span>
          </span>
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted sm:w-44">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {percent}%
          </span>
        </div>
        {next ? (
          <Link
            href={next.href}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            次のステップ: {next.label}
            <ArrowRight className="size-3.5" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-700">
            <PartyPopper className="size-4" />
            全ステップ完了
          </span>
        )}
      </div>

      {/* clickable stepper */}
      <div className="mt-3 flex items-start overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-start">
            <Link
              href={s.href}
              title={s.label}
              className="flex w-14 shrink-0 flex-col items-center gap-1"
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[11px] font-bold transition-colors",
                  s.status === "done"
                    ? "bg-primary text-primary-foreground"
                    : s.status === "current"
                      ? "bg-primary/10 text-primary ring-2 ring-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {s.status === "done" ? <Check className="size-3.5" /> : s.num}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-[10px] leading-tight",
                  s.status === "current"
                    ? "font-semibold text-primary"
                    : s.status === "done"
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </Link>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  "mt-3 h-px w-3 shrink-0 sm:w-5",
                  s.status === "done" ? "bg-primary/50" : "bg-border",
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
