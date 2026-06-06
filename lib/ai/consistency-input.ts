import "server-only";
import { db } from "@/lib/db";
import { computeTotals, aggregateByCategory } from "@/lib/estimate-calc";
import { buildScheduleView } from "@/lib/schedule-view";
import type { ConsistencyInput } from "./providers";
import type { NonWorkingPeriod } from "@/lib/holidays";

/** Assemble all artifacts of a project for a cross-artifact consistency review. */
export async function buildConsistencyInput(
  orgId: string,
  projectId: string,
): Promise<ConsistencyInput | null> {
  const project = await db.projects.getById(orgId, projectId);
  if (!project) return null;

  const hearing = await db.hearings.getByProject(orgId, projectId);
  const reqDoc = await db.documents.getLatest(orgId, projectId, "requirements");
  const est = await db.estimates.getLatest(orgId, projectId);
  const sch = await db.schedules.getLatest(orgId, projectId);
  const sd = await db.screenDesign.getLatest(orgId, projectId);
  const scope = await db.scope.getLatest(orgId, projectId);

  const estimate = est
    ? (() => {
        const totals = computeTotals(
          est.items,
          est.estimate.bufferRate,
          est.estimate.taxRate,
        );
        return {
          total: totals.total,
          personDays: totals.totalPersonDays,
          categories: aggregateByCategory(est.items).map((a) => ({
            key: a.key,
            amount: a.amount,
          })),
        };
      })()
    : null;

  const schedule = sch
    ? (() => {
        const view = buildScheduleView(
          sch.tasks,
          sch.schedule.startDate ?? new Date().toISOString().slice(0, 10),
          {
            periods: (sch.schedule.nonWorkingPeriods ??
              []) as NonWorkingPeriod[],
          },
        );
        return {
          start: view.projectStart,
          end: view.projectEnd,
          businessDays: view.totalBusinessDays,
        };
      })()
    : null;

  const screens = sd
    ? sd.screens.map((s) => ({ key: s.screenKey, name: s.screenName }))
    : null;
  const transitions = sd
    ? (() => {
        const idToKey = new Map(sd.screens.map((s) => [s.id, s.screenKey]));
        return sd.transitions
          .map((t) => ({
            from: idToKey.get(t.fromScreenId ?? "") ?? "",
            to: idToKey.get(t.toScreenId ?? "") ?? "",
            trigger: t.triggerAction ?? "",
          }))
          .filter((t) => t.from && t.to);
      })()
    : null;

  return {
    project: {
      projectName: project.projectName,
      clientName: project.clientName,
      budgetMin: project.budgetMin,
      budgetMax: project.budgetMax,
      expectedDeliveryDate: project.expectedDeliveryDate,
      proposalDueDate: project.proposalDueDate,
      developmentForm: project.developmentForm,
      projectStage: project.projectStage,
      monthlyRate: project.monthlyRate,
      contractMonths: project.contractMonths,
      description: project.description,
    },
    openQuestions: hearing?.openQuestions ?? [],
    requirements: reqDoc?.contentJson
      ? reqDoc.contentJson.map((s) => ({
          key: s.key,
          heading: s.heading,
          markdown: s.markdown,
        }))
      : null,
    screens,
    transitions,
    estimate,
    schedule,
    scope: scope?.plan ?? null,
  };
}
