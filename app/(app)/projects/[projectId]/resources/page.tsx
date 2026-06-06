import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  ReceivedMaterialsCard,
  ReferenceLinksCard,
} from "@/components/projects/resource-lists";
import { FileUploadCard } from "@/components/projects/file-upload";
import { LinksCard } from "@/components/projects/overview-extras";

export default async function ResourcesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const p = await db.projects.getById(user.orgId, projectId);
  if (!p) notFound();
  const files = await db.files.listByProject(user.orgId, p.id);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">資料</h2>
        <p className="text-sm text-muted-foreground">
          会議の録音音声・議事録などのアップロード、先方からの受領資料（共有ドライブ）、類似製品・参考情報のリンクを集約します。
        </p>
      </div>
      <FileUploadCard projectId={p.id} files={files} />
      <ReceivedMaterialsCard
        projectId={p.id}
        materials={p.receivedMaterials ?? []}
      />
      <ReferenceLinksCard
        projectId={p.id}
        references={p.referenceLinks ?? []}
      />
      <LinksCard projectId={p.id} links={p.links ?? []} />
    </div>
  );
}
