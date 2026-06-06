import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SystemDiagramView } from "@/components/design/system-diagram-view";

export default async function DesignPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const sd = await db.screenDesign.getLatest(user.orgId, projectId);

  return (
    <SystemDiagramView
      projectId={projectId}
      hasDesign={!!sd}
      version={sd?.design.version ?? 0}
      architecture={sd?.design.architecture ?? null}
      designPrompt={sd?.design.designPrompt ?? ""}
    />
  );
}
