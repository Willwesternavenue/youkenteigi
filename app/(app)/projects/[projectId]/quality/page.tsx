import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { QualityView } from "@/components/requirements/quality-view";

export default async function QualityPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const latest = await db.quality.getLatest(user.orgId, projectId);

  return (
    <QualityView
      projectId={projectId}
      report={latest?.report ?? null}
      version={latest?.version ?? 0}
      createdAt={latest?.createdAt ?? null}
    />
  );
}
