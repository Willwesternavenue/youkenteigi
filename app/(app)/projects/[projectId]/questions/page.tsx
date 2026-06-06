import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function QuestionsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const hearing = await db.hearings.getByProject(user.orgId, projectId);
  const questions = hearing?.openQuestions ?? [];

  // group by category
  const grouped = questions.reduce<Record<string, string[]>>((acc, q) => {
    (acc[q.category] ??= []).push(q.question);
    return acc;
  }, {});
  const categories = Object.keys(grouped);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">クライアントへの追加質問</h2>
        <p className="text-sm text-muted-foreground">
          AI整理で抽出された未確認事項を、カテゴリ別に確認できます。
        </p>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            まだ質問がありません。
            <Link href={`/projects/${projectId}/organize`} className="mx-1 underline">
              AI整理
            </Link>
            を実行してください。
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {categories.map((cat) => (
            <Card key={cat}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">{cat}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1.5 pl-5 text-sm">
                  {grouped[cat].map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
