import { Badge } from "@/components/ui/badge";
import {
  PROJECT_STATUS_LABELS,
  type ProjectStatus,
} from "@/types/domain";
import { cn } from "@/lib/utils";

const STYLES: Record<ProjectStatus, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  in_review: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  submitted: "bg-sky-100 text-sky-800 border-sky-200",
  won: "bg-primary/10 text-primary border-primary/20",
  lost: "bg-rose-100 text-rose-700 border-rose-200",
};

export function StatusBadge({ status }: { status: string }) {
  const s = (status as ProjectStatus) in PROJECT_STATUS_LABELS
    ? (status as ProjectStatus)
    : "draft";
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", STYLES[s])}
    >
      {PROJECT_STATUS_LABELS[s]}
    </Badge>
  );
}
