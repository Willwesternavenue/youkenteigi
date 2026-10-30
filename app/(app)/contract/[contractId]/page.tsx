import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { ContractEditor } from "@/components/contract/contract-editor";

export default async function ContractPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  const user = await requireUser();
  const contract = await db.contracts.get(user.orgId, contractId);
  if (!contract) notFound();

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <Link href="/contract" className="text-sm text-muted-foreground hover:underline">
        ← 契約書一覧
      </Link>
      <ContractEditor
        key={contract.id}
        contractId={contract.id}
        projectId={contract.projectId}
        projectName={contract.projectName}
        showProjectLink
        initialValues={contract.values}
        initialVersion={contract.latestVersion}
        canEdit={can(user.role, "document.edit")}
      />
    </div>
  );
}
