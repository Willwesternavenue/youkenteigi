import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { ReviewBoard } from "@/components/review/review-board";

// AI生成は最長~120秒。Server Actionのタイムアウト既定値をページ単位で
// 引き上げる（Vercel Pro: 最大300秒）。
export const maxDuration = 300;


export default async function ReviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const [feed, summary] = await Promise.all([
    db.review.feed(user.orgId, projectId),
    db.review.summary(user.orgId, projectId),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">レビュー・承認</h2>
        <p className="text-sm text-muted-foreground">
          提案内容に対する社内のピアレビュー（コメント）と承認・差し戻しを記録します。
        </p>
      </div>
      <ReviewBoard
        projectId={projectId}
        feed={feed}
        summary={summary}
        canComment={can(user.role, "review.comment")}
        canApprove={can(user.role, "review.approve")}
      />
    </div>
  );
}
