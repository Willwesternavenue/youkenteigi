import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 「サンプル」badge for the fixed showcase project (projects.is_sample).
 * Read-only marker only — the project is fully editable like any other; it just
 * exists so the team can see a complete example, and can be regenerated with
 * `npm run db:seed-sample`.
 */
export function SampleBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700",
        className,
      )}
    >
      <Sparkles className="size-3" />
      サンプル
    </span>
  );
}
