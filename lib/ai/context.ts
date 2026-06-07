import "server-only";
import { db } from "@/lib/db";
import { findSimilarProjects } from "./rag";
import type {
  GenerationContext,
  GeneratedDesign,
  OrganizedHearing,
  ProjectSummary,
} from "./providers";
import type { ProjectRow } from "@/db/schema";

/** Reconstruct a GeneratedDesign from the latest saved screen design. */
export async function loadDesign(
  orgId: string,
  projectId: string,
): Promise<GeneratedDesign | null> {
  const sd = await db.screenDesign.getLatest(orgId, projectId);
  if (!sd) return null;
  const idToKey = new Map(sd.screens.map((s) => [s.id, s.screenKey]));
  return {
    screens: sd.screens.map((s) => ({
      key: s.screenKey,
      name: s.screenName,
      role: s.userRole ?? undefined,
      purpose: s.purpose ?? "",
      uiElements: s.uiElements ?? [],
      states: s.states ?? undefined,
      priority: s.priority ?? undefined,
      wireframe: (s.wireframe ?? undefined) as
        | GeneratedDesign["screens"][number]["wireframe"]
        | undefined,
    })),
    transitions: sd.transitions
      .map((t) => ({
        from: idToKey.get(t.fromScreenId ?? "") ?? "",
        to: idToKey.get(t.toScreenId ?? "") ?? "",
        trigger: t.triggerAction ?? "",
        description: t.description ?? undefined,
      }))
      .filter((t) => t.from && t.to),
    architecture: sd.design.architecture ?? { layers: [], edges: [] },
    designPrompt: sd.design.designPrompt ?? "",
  };
}

function summary(p: ProjectRow): ProjectSummary {
  return {
    projectName: p.projectName,
    clientName: p.clientName,
    industry: p.industry,
    budgetMin: p.budgetMin,
    budgetMax: p.budgetMax,
    expectedDeliveryDate: p.expectedDeliveryDate,
    developmentForm: p.developmentForm,
    projectStage: p.projectStage,
    description: p.description,
    note: p.note,
  };
}

/** Build the AI generation context (project + hearing + organized) for a project. */
export async function buildGenerationContext(
  orgId: string,
  projectId: string,
): Promise<GenerationContext | null> {
  const project = await db.projects.getById(orgId, projectId);
  if (!project) return null;
  const hearing = await db.hearings.getByProject(orgId, projectId);
  const organized: OrganizedHearing | null = hearing?.organizedAt
    ? ({
        summary: hearing.summary ?? "",
        confirmedFacts: hearing.confirmedFacts ?? [],
        assumptions: hearing.assumptions ?? [],
        openQuestions: hearing.openQuestions ?? [],
        recommendedPhase: project.recommendedPhase ?? "mvp",
        recommendedPlatform: project.recommendedPlatform ?? "web",
        recommendedDeployment: project.recommendedDeployment ?? "cloud",
        risks: hearing.risks ?? [],
        recommendedAiModel: hearing.recommendedAiModel ?? undefined,
      } as OrganizedHearing)
    : null;
  const design = await loadDesign(orgId, projectId);
  const [rfpTpl, reqTpl] = await Promise.all([
    db.templates.getDefaultBody(orgId, "rfp"),
    db.templates.getDefaultBody(orgId, "requirements"),
  ]);
  // RAG: similar past projects (signal = description + hearing + confirmed facts).
  const signal = [
    project.projectName,
    project.description,
    hearing?.rawText,
    organized?.confirmedFacts.join(" "),
  ]
    .filter(Boolean)
    .join(" ");
  const references = await findSimilarProjects(
    orgId,
    projectId,
    signal,
    project.industry ?? null,
  );
  return {
    project: summary(project),
    hearingText: hearing?.rawText ?? "",
    organized,
    design,
    templates: {
      rfp: rfpTpl ?? undefined,
      requirements: reqTpl ?? undefined,
    },
    references,
  };
}
