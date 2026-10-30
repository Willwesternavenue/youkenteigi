"use client";

import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FIELD_LABELS, type ContractValues } from "@/lib/contract/render";
import type { ContractIssue, ContractReview } from "@/lib/ai/providers";

const SEVERITY: Record<ContractIssue["severity"], { label: string; className: string }> = {
  high: { label: "要対応", className: "bg-red-100 text-red-800" },
  medium: { label: "要確認", className: "bg-amber-100 text-amber-800" },
  low: { label: "参考", className: "bg-slate-100 text-slate-700" },
};

/**
 * AIレビュー・提案の結果。提案は「反映」を押すまで差し込み値に入らず、
 * 反映しても保存するまで確定しない。本文（弁護士レビュー済み）は対象外。
 */
export function ContractReviewPanel({
  review,
  values,
  onApply,
  onApplyAll,
  onFocusField,
  onClose,
}: {
  review: ContractReview;
  values: ContractValues;
  onApply: (field: string, value: string) => void;
  onApplyAll: () => void;
  onFocusField: (field: string) => void;
  onClose: () => void;
}) {
  const isEmpty = (field: string) => (values[field] ?? "").trim() === "";
  const pending = review.suggestions.filter((s) => isEmpty(s.field));

  return (
    <section className="space-y-4 rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">AIレビュー・提案</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            弁護士レビュー済みの本文は変更しません。提案は空欄の差し込み値だけで、「反映」を押すまで入力されず、反映後も保存するまで確定しません。
          </p>
        </div>
        <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="閉じる">
          <X className="size-4" />
        </Button>
      </div>
      {review.summary && <p className="text-sm">{review.summary}</p>}

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground">食い違いの指摘</h4>
        {review.issues.length === 0 ? (
          <p className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 className="size-4" />
            食い違いは見つかりませんでした
          </p>
        ) : (
          <ul className="space-y-2">
            {review.issues.map((issue, i) => (
              <li key={i} className="rounded-md border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[11px] font-medium",
                      SEVERITY[issue.severity].className,
                    )}
                  >
                    {SEVERITY[issue.severity].label}
                  </span>
                  <span className="font-medium">{issue.title}</span>
                  {issue.field && (
                    <button
                      type="button"
                      onClick={() => onFocusField(issue.field!)}
                      className="text-xs text-primary underline"
                    >
                      「{FIELD_LABELS[issue.field]}」へ
                    </button>
                  )}
                </div>
                <p className="mt-1 text-muted-foreground">{issue.detail}</p>
                {issue.suggestion && <p className="mt-1">→ {issue.suggestion}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold text-muted-foreground">空欄への提案</h4>
          {pending.length > 1 && (
            <Button size="sm" variant="outline" onClick={onApplyAll}>
              空欄にすべて反映（{pending.length}件）
            </Button>
          )}
        </div>
        {review.suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            提案できる空欄はありませんでした（記述系の空欄がないか、根拠になる情報が足りません）。
          </p>
        ) : (
          <ul className="space-y-2">
            {review.suggestions.map((s) => {
              const applicable = isEmpty(s.field);
              return (
                <li key={s.field} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{FIELD_LABELS[s.field]}</span>
                    <Button
                      size="sm"
                      variant={applicable ? "default" : "ghost"}
                      disabled={!applicable}
                      onClick={() => onApply(s.field, s.value)}
                    >
                      {applicable ? "反映" : "入力済み"}
                    </Button>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{s.value}</p>
                  {s.reason && <p className="mt-1 text-xs text-muted-foreground">根拠：{s.reason}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
