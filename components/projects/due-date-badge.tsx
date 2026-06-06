import { CalendarClock } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Days from today (local) until the given YYYY-MM-DD date. null if unparseable. */
function daysUntil(date: string): number | null {
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/**
 * 提案期限を見出しの横で目立たせる。期限が近い/超過していると色で警告。
 * 期限未設定なら何も表示しない。
 */
export function DueDateBadge({ date }: { date: string | null }) {
  if (!date) return null;
  const left = daysUntil(date);

  const overdue = left != null && left < 0;
  const urgent = left != null && left >= 0 && left <= 7;

  let suffix = "";
  if (left != null) {
    if (left === 0) suffix = "（本日）";
    else if (left > 0) suffix = `（あと${left}日）`;
    else suffix = `（${-left}日超過）`;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold",
        overdue
          ? "border-rose-300 bg-rose-50 text-rose-700"
          : urgent
            ? "border-amber-300 bg-amber-50 text-amber-700"
            : "border-amber-200 bg-amber-50/60 text-amber-700",
      )}
    >
      <CalendarClock className="size-3.5" />
      提案期限 {formatDate(date)}
      {suffix && <span className="font-bold">{suffix}</span>}
    </span>
  );
}
