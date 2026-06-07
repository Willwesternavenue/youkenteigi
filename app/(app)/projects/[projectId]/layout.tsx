import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProjectNav, ProjectSubTabs } from "@/components/projects/project-nav";
import { StatusSelect } from "@/components/projects/status-select";
import { StageSelect } from "@/components/projects/stage-select";
import { SampleBadge } from "@/components/projects/sample-badge";
import {
  AssistantProvider,
  AssistantShell,
  AssistantTrigger,
  AssistantDock,
} from "@/components/ai/assistant-panel";
import { DueDateBadge } from "@/components/projects/due-date-badge";
import { ProjectProgress } from "@/components/projects/project-progress";
import { getProjectProgress } from "@/lib/project-progress";
import { formatBudgetRange } from "@/lib/format";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const project = await db.projects.getById(user.orgId, projectId);
  if (!project) notFound();
  const progress = await getProjectProgress(user.orgId, project.id);

  return (
    <AssistantProvider projectId={project.id}>
      <AssistantShell>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold">{project.projectName}</h1>
              {project.isSample && <SampleBadge />}
              <StageSelect
                projectId={project.id}
                stage={project.projectStage}
              />
              <DueDateBadge date={project.proposalDueDate} />
            </div>
            <p className="text-sm text-muted-foreground">
              {project.clientName}
              {project.industry ? ` · ${project.industry}` : ""} ·{" "}
              {formatBudgetRange(project.budgetMin, project.budgetMax)}
            </p>
          </div>
          <StatusSelect projectId={project.id} status={project.status} />
        </div>

        <ProjectProgress progress={progress} />

        <div className="flex flex-col gap-5 md:flex-row md:gap-6">
          <aside className="shrink-0 space-y-3 md:w-44 md:border-r md:pr-2">
            <ProjectNav projectId={project.id} />
            <AssistantTrigger />
          </aside>
          <div className="min-w-0 flex-1 space-y-4">
            <ProjectSubTabs projectId={project.id} />
            <div>{children}</div>
          </div>
          <AssistantDock />
        </div>
      </AssistantShell>
    </AssistantProvider>
  );
}
