import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MeetingNotesView } from "@/components/projects/meeting-notes";

export default async function MinutesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const p = await db.projects.getById(user.orgId, projectId);
  if (!p) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">議事録</h2>
        <p className="text-sm text-muted-foreground">
          打ち合わせごとに議事録（Notion 等のリンク）を追加して、商談の履歴を残します。
        </p>
      </div>
      <MeetingNotesView projectId={p.id} notes={p.meetingNotes ?? []} />
    </div>
  );
}
