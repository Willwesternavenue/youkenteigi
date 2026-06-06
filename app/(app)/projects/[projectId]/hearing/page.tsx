import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { HearingEditor } from "@/components/hearing/hearing-editor";

export default async function HearingPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const hearing = await db.hearings.getByProject(user.orgId, projectId);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">ヒアリング内容入力</h2>
        <p className="text-sm text-muted-foreground">
          初回商談の内容を貼り付けて保存し、「AI整理」タブで内容を整理します。
        </p>
      </div>
      <HearingEditor
        projectId={projectId}
        initialText={hearing?.rawText ?? ""}
        initialDate={hearing?.meetingDate ?? ""}
        initialTime={hearing?.meetingTime ?? ""}
        initialFormat={hearing?.meetingFormat ?? ""}
        initialParticipants={hearing?.clientParticipants ?? ""}
        initialOurParticipants={hearing?.ourParticipants ?? ""}
      />
    </div>
  );
}
