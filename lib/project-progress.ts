import "server-only";
import { db } from "@/lib/db";

/**
 * Per-project workflow progress: which steps are done (have artifacts) and what
 * the next action is. Mirrors the numbered left-nav so new members see "どこまで
 * 完了／次に何を" at a glance. Each step "done" = its artifact exists.
 */

export interface ProgressStep {
  key: string;
  label: string; // short label for the stepper
  num: number;
  href: string;
  status: "done" | "current" | "todo";
}

export interface ProjectProgress {
  steps: ProgressStep[];
  doneCount: number;
  total: number;
  percent: number;
  next: { label: string; href: string } | null;
}

export async function getProjectProgress(
  orgId: string,
  projectId: string,
): Promise<ProjectProgress> {
  const base = `/projects/${projectId}`;
  const [hearing, rfp, scope, req, design, est, sch, deck, summary] =
    await Promise.all([
      db.hearings.getByProject(orgId, projectId),
      db.documents.getLatest(orgId, projectId, "rfp"),
      db.scope.getLatest(orgId, projectId),
      db.documents.getLatest(orgId, projectId, "requirements"),
      db.screenDesign.getLatest(orgId, projectId),
      db.estimates.getLatest(orgId, projectId),
      db.schedules.getLatest(orgId, projectId),
      db.decks.getLatest(orgId, projectId),
      db.review.summary(orgId, projectId),
    ]);

  const hasHearingText = !!hearing?.rawText && hearing.rawText.trim() !== "";
  const organized = !!hearing?.organizedAt;

  const defs: { key: string; label: string; href: string; done: boolean }[] = [
    { key: "input", label: "議事録", href: `${base}/hearing`, done: organized },
    { key: "rfp", label: "RFP", href: `${base}/rfp`, done: !!rfp },
    { key: "scope", label: "WBS", href: `${base}/scope`, done: !!scope },
    { key: "requirements", label: "要件定義", href: `${base}/requirements`, done: !!req },
    { key: "design", label: "画面設計", href: `${base}/design`, done: !!design },
    { key: "estimate", label: "見積", href: `${base}/estimate`, done: !!est },
    { key: "schedule", label: "スケジュール", href: `${base}/schedule`, done: !!sch },
    { key: "proposal", label: "スライド", href: `${base}/slides`, done: !!deck },
    { key: "review", label: "承認", href: `${base}/review`, done: summary.approved > 0 },
  ];

  const currentIdx = defs.findIndex((d) => !d.done);
  const steps: ProgressStep[] = defs.map((d, i) => ({
    key: d.key,
    label: d.label,
    num: i + 1,
    href: d.href,
    status: d.done ? "done" : i === currentIdx ? "current" : "todo",
  }));
  const doneCount = defs.filter((d) => d.done).length;
  const total = defs.length;

  let next: ProjectProgress["next"] = null;
  if (currentIdx >= 0) {
    const cur = defs[currentIdx];
    if (cur.key === "input") {
      // 議事録ステップは入力→AI整理の2段階を文脈で誘導
      next = hasHearingText
        ? { label: "AI整理を実行", href: `${base}/organize` }
        : { label: "ヒアリングを入力", href: `${base}/hearing` };
    } else {
      next = { label: `${cur.label}を作成`, href: cur.href };
    }
  }

  return {
    steps,
    doneCount,
    total,
    percent: Math.round((doneCount / total) * 100),
    next,
  };
}
