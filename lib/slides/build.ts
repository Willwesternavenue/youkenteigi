import "server-only";
import { db } from "@/lib/db";
import { buildDeck, type DeckInput, type Slide } from "./deck";
import {
  computeTotals,
  aggregateByCategory,
  planForTotal,
} from "@/lib/estimate-calc";
import { buildScheduleView } from "@/lib/schedule-view";
import { formatYen, formatDate } from "@/lib/format";

/** Load the latest requirements / estimate / schedule for a project and build the deck. */
export async function loadDeck(
  orgId: string,
  projectId: string,
): Promise<{ slides: Slide[]; hasRequirements: boolean } | null> {
  const project = await db.projects.getById(orgId, projectId);
  if (!project) return null;
  const org = await db.orgs.getById(orgId);

  const reqDoc = await db.documents.getLatest(orgId, projectId, "requirements");
  const est = await db.estimates.getLatest(orgId, projectId);
  const sch = await db.schedules.getLatest(orgId, projectId);
  const sd = await db.screenDesign.getLatest(orgId, projectId);

  const input: DeckInput = {
    project: {
      projectName: project.projectName,
      clientName: project.clientName,
      orgName: org?.name,
    },
    requirements: reqDoc?.contentJson
      ? { sections: reqDoc.contentJson }
      : null,
    estimate: est
      ? (() => {
          const totals = computeTotals(
            est.items,
            est.estimate.bufferRate,
            est.estimate.taxRate,
          );
          return {
            total: formatYen(totals.total),
            plan: planForTotal(totals.total),
            personDays: `${totals.totalPersonDays} 人日`,
            phases: aggregateByCategory(est.items).map((a) => ({
              label: a.key,
              value: formatYen(a.amount),
            })),
          };
        })()
      : null,
    schedule: sch
      ? (() => {
          const view = buildScheduleView(
            sch.tasks,
            sch.schedule.startDate ?? new Date().toISOString().slice(0, 10),
            { periods: (sch.schedule.nonWorkingPeriods ?? []) as { name: string; start: string; end: string }[] },
          );
          return {
            start: view.projectStart,
            end: view.projectEnd,
            phases: view.phases.map((p) => ({
              phase: p.phase,
              weeks: p.weeks,
              start: formatDate(p.startDate),
              end: formatDate(p.endDate),
            })),
            milestones: sch.milestones
              .filter((m) => m.isClientVisible)
              .map((m) => ({
                title: m.title,
                date: formatDate(m.milestoneDate),
              })),
          };
        })()
      : null,
    design: sd
      ? (() => {
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
          };
        })()
      : null,
  };

  return { slides: buildDeck(input), hasRequirements: !!reqDoc };
}

/**
 * Load the editable deck: the saved (hand-edited) deck if one exists, otherwise
 * the auto-built deck. Used by the editor and the PPTX/PDF export.
 */
export async function loadEditableDeck(
  orgId: string,
  projectId: string,
): Promise<{
  slides: Slide[];
  hasRequirements: boolean;
  source: "saved" | "auto";
} | null> {
  const reqDoc = await db.documents.getLatest(orgId, projectId, "requirements");
  const hasRequirements = !!reqDoc;
  const saved = await db.decks.getLatest(orgId, projectId);
  if (saved) {
    return {
      slides: saved.slides as Slide[],
      hasRequirements,
      source: "saved",
    };
  }
  const auto = await loadDeck(orgId, projectId);
  return {
    slides: auto?.slides ?? [],
    hasRequirements,
    source: "auto",
  };
}
