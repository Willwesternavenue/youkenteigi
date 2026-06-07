import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { FilePlus2 } from "lucide-react";
import {
  ProjectListTable,
  type ProjectListItem,
} from "@/components/projects/project-list-table";

export default async function ProjectsPage() {
  const user = await requireUser();
  const rows = await db.projects.list(user.orgId);
  const projects: ProjectListItem[] = rows.map((p) => ({
    id: p.id,
    projectName: p.projectName,
    clientName: p.clientName,
    status: p.status,
    salesOwner: p.salesOwner,
    budgetMin: p.budgetMin,
    budgetMax: p.budgetMax,
    proposalDueDate: p.proposalDueDate,
    updatedAt: p.updatedAt,
    isSample: p.isSample,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">案件一覧</h1>
        <Button render={<Link href="/projects/new" />} nativeButton={false}>
          <FilePlus2 className="size-4" />
          新規案件
        </Button>
      </div>
      <ProjectListTable projects={projects} />
    </div>
  );
}
