"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MessageSquarePlus,
  Check,
  Undo2,
  CircleCheckBig,
  CircleAlert,
  CheckCircle2,
  Circle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  COMMENT_TYPES,
  COMMENT_TYPE_LABELS,
  ROLE_LABELS,
  type CommentType,
  type Role,
} from "@/types/domain";
import {
  postReviewComment,
  postApproval,
  setCommentStatus,
} from "@/app/_actions/reviews";
import type { ReviewFeedItem, ApprovalSummary } from "@/lib/db";

const ROLE_COLOR: Record<string, string> = {
  admin: "bg-slate-700",
  manager: "bg-violet-600",
  sales: "bg-sky-600",
  pm: "bg-primary",
  engineer: "bg-emerald-600",
  designer: "bg-rose-500",
  viewer: "bg-slate-400",
};

function initials(name: string | null): string {
  if (!name) return "?";
  return name.trim().slice(0, 1);
}

function Avatar({ name, role }: { name: string | null; role: string | null }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
        ROLE_COLOR[role ?? "viewer"] ?? "bg-slate-400",
      )}
    >
      {initials(name)}
    </span>
  );
}

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReviewBoard({
  projectId,
  feed,
  summary,
  canComment,
  canApprove,
}: {
  projectId: string;
  feed: ReviewFeedItem[];
  summary: ApprovalSummary;
  canComment: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"comment" | "approved" | "rejected">(
    "comment",
  );
  const [commentType, setCommentType] = useState<CommentType>("question");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const [resolvePending, startResolve] = useTransition();

  const openComments = feed.filter(
    (f) => f.kind === "comment" && f.status !== "resolved",
  ).length;

  function resolveComment(id: string, resolved: boolean) {
    startResolve(async () => {
      const res = await setCommentStatus(projectId, id, resolved);
      if (res.ok) {
        toast.success(resolved ? "対応済みにしました" : "未対応に戻しました");
        router.refresh();
      } else toast.error("更新できませんでした");
    });
  }

  const overall =
    summary.rejected > 0
      ? { label: "差し戻しあり", cls: "bg-rose-100 text-rose-700 border-rose-200", Icon: CircleAlert }
      : summary.approved > 0
        ? { label: `承認 ${summary.approved}件`, cls: "bg-emerald-100 text-emerald-700 border-emerald-200", Icon: CircleCheckBig }
        : { label: "未承認", cls: "bg-slate-100 text-slate-600 border-slate-200", Icon: Clock };

  function submit() {
    start(async () => {
      const res =
        mode === "comment"
          ? await postReviewComment(projectId, { commentType, body })
          : await postApproval(projectId, {
              status: mode,
              comment: body || undefined,
            });
      if (res.ok) {
        setBody("");
        toast.success(
          mode === "comment"
            ? "コメントを投稿しました"
            : mode === "approved"
              ? "承認しました"
              : "差し戻しました",
        );
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-5">
      {/* approval summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between gap-2 text-sm">
            <span>承認状況</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
                overall.cls,
              )}
            >
              <overall.Icon className="size-3.5" />
              {overall.label}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summary.approvers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {summary.approvers.map((a, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-2 rounded-full border bg-white py-1 pl-1 pr-2.5 text-xs"
                >
                  <Avatar name={a.name} role={a.role} />
                  <span className="font-medium">{a.name ?? "—"}</span>
                  <span className="text-muted-foreground">
                    {ROLE_LABELS[a.role as Role] ?? a.role}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 font-semibold",
                      a.status === "approved"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-rose-100 text-rose-700",
                    )}
                  >
                    {a.status === "approved" ? "承認" : "差し戻し"}
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              まだ承認・差し戻しはありません。
            </p>
          )}
        </CardContent>
      </Card>

      {/* composer */}
      {canComment && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MessageSquarePlus className="size-4 text-primary" />
              レビューコメント・承認
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <ModeTab active={mode === "comment"} onClick={() => setMode("comment")}>
                コメント
              </ModeTab>
              <ModeTab
                active={mode === "approved"}
                disabled={!canApprove}
                onClick={() => setMode("approved")}
                tone="approve"
              >
                <Check className="size-3.5" />
                承認
              </ModeTab>
              <ModeTab
                active={mode === "rejected"}
                disabled={!canApprove}
                onClick={() => setMode("rejected")}
                tone="reject"
              >
                <Undo2 className="size-3.5" />
                差し戻し
              </ModeTab>
              {!canApprove && (
                <span className="self-center text-xs text-muted-foreground">
                  （承認・差し戻しはマネージャー以上）
                </span>
              )}
            </div>

            {mode === "comment" && (
              <Select
                value={commentType}
                onValueChange={(v) => v && setCommentType(v as CommentType)}
              >
                <SelectTrigger className="w-56">
                  <SelectValue>
                    {(v: string | null) =>
                      v ? COMMENT_TYPE_LABELS[v as CommentType] : "種別"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {COMMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {COMMENT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder={
                mode === "comment"
                  ? "レビューコメントを入力…"
                  : "コメント（任意）— 承認/差し戻しの理由など"
              }
            />
            <div className="flex justify-end">
              <Button
                onClick={submit}
                disabled={pending || (mode === "comment" && !body.trim())}
                variant={mode === "rejected" ? "outline" : "default"}
              >
                {pending
                  ? "送信中…"
                  : mode === "comment"
                    ? "コメントを投稿"
                    : mode === "approved"
                      ? "承認する"
                      : "差し戻す"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* activity timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between gap-2 text-sm">
            <span>レビュー履歴</span>
            {openComments > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                未対応コメント {openComments}件
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {feed.length > 0 ? (
            <ol className="space-y-3">
              {feed.map((item) => {
                const resolved =
                  item.kind === "comment" && item.status === "resolved";
                return (
                <li key={item.id} className="flex gap-3">
                  <Avatar name={item.authorName} role={item.authorRole} />
                  <div
                    className={cn(
                      "min-w-0 flex-1 rounded-lg border bg-white p-3",
                      resolved && "opacity-65",
                    )}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">
                        {item.authorName ?? "—"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {ROLE_LABELS[item.authorRole as Role] ?? item.authorRole}
                      </span>
                      {item.kind === "approval" ? (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            item.variant === "approved"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700",
                          )}
                        >
                          {item.variant === "approved" ? "承認" : "差し戻し"}
                        </span>
                      ) : (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {COMMENT_TYPE_LABELS[item.variant as CommentType] ??
                            "コメント"}
                        </span>
                      )}
                      {resolved && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="size-3" />
                          対応済み
                        </span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {when(item.createdAt)}
                      </span>
                    </div>
                    {item.body ? (
                      <p
                        className={cn(
                          "whitespace-pre-wrap text-sm",
                          resolved && "line-through",
                        )}
                      >
                        {item.body}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        （コメントなし）
                      </p>
                    )}
                    {item.kind === "comment" && canComment && (
                      <div className="mt-1.5 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          disabled={resolvePending}
                          onClick={() => resolveComment(item.id, !resolved)}
                        >
                          {resolved ? (
                            <>
                              <Undo2 className="size-3.5" />
                              未対応に戻す
                            </>
                          ) : (
                            <>
                              <Circle className="size-3.5" />
                              対応済みにする
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              まだレビューコメント・承認はありません。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ModeTab({
  active,
  disabled,
  onClick,
  tone = "neutral",
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  tone?: "neutral" | "approve" | "reject";
  children: React.ReactNode;
}) {
  const activeCls =
    tone === "approve"
      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
      : tone === "reject"
        ? "border-rose-500 bg-rose-50 text-rose-700"
        : "border-primary bg-primary/10 text-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? activeCls
          : "border-transparent text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
