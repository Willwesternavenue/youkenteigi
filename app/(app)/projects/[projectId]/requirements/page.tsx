import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  DocumentEditor,
  type EditorDocument,
} from "@/components/documents/document-editor";

export default async function RequirementsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const latest = await db.documents.getLatest(
    user.orgId,
    projectId,
    "requirements",
  );

  const document: EditorDocument | null = latest
    ? {
        id: latest.id,
        title: latest.title,
        version: latest.version,
        sections: latest.contentJson ?? [],
      }
    : null;

  return (
    <DocumentEditor
      key={latest ? `${latest.id}` : "empty"}
      projectId={projectId}
      type="requirements"
      label="要件定義書"
      document={document}
    />
  );
}
