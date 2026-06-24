import Link from "next/link";
import { TriangleAlert } from "lucide-react";

/**
 * Shown on the estimate tab when the estimate was changed more recently than the
 * last consistency check (and a screen design exists). Adjusting the estimate
 * doesn't touch 画面設計/要件定義, so a scope change can drift out of sync — this
 * nudges the user to run the cross-artifact 整合性チェック. Self-clears once the
 * check runs (its report becomes newer than the estimate).
 */
export function ConsistencyNotice({ projectId }: { projectId: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <div className="space-y-0.5">
        <p className="font-medium text-amber-900">
          見積を更新しました。画面設計・要件定義と内容が乖離している可能性があります。
        </p>
        <p className="text-amber-800">
          スコープ（工程）を変えた場合は、
          <Link
            href={`/projects/${projectId}/consistency`}
            className="font-medium underline underline-offset-2 hover:text-amber-950"
          >
            整合性チェック
          </Link>
          で見積・画面設計・要件定義の食い違いを確認することをおすすめします。
        </p>
      </div>
    </div>
  );
}
