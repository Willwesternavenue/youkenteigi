import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ScopeWbsView } from "@/components/scope/scope-wbs-view";
import {
  DEVELOPMENT_FORM_LABELS,
  DEFAULT_DEVELOPMENT_FORM,
  type DevelopmentForm,
} from "@/types/domain";

export default async function ScopePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const p = await db.projects.getById(user.orgId, projectId);
  if (!p) notFound();
  const saved = await db.scope.getLatest(user.orgId, projectId);

  const currentForm = (p.developmentForm ??
    DEFAULT_DEVELOPMENT_FORM) as DevelopmentForm;
  const currentFormLabel =
    DEVELOPMENT_FORM_LABELS[currentForm] ?? currentForm;
  const stale =
    !!saved && (saved.developmentForm ?? null) !== (p.developmentForm ?? null);

  return (
    <ScopeWbsView
      projectId={p.id}
      plan={saved?.plan ?? null}
      version={saved?.version ?? 0}
      currentFormLabel={currentFormLabel}
      stale={stale}
    />
  );
}
