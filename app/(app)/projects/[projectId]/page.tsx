import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBudgetRange, formatDate } from "@/lib/format";
import { DEVELOPMENT_FORM_LABELS, type DevelopmentForm } from "@/types/domain";
import { DescriptionCard } from "@/components/projects/overview-extras";
import { RecommendationsCard } from "@/components/projects/recommendations-card";
import { ClientNameRow } from "@/components/projects/client-hp";
import {
  OwnerRow,
  MonthlyBudgetRow,
} from "@/components/projects/owner-rows";

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const p = await db.projects.getById(user.orgId, projectId);
  if (!p) notFound();
  const meProfile = await db.profiles.getById(user.userId);
  const me = meProfile?.name ?? user.name;

  return (
    <div className="space-y-5">
      <DescriptionCard projectId={p.id} description={p.description ?? ""} />

      <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">案件情報</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <ClientNameRow
              projectId={p.id}
              clientName={p.clientName}
              domain={p.clientDomain}
            />
            <Row label="業界" value={p.industry} />
            <Row label="部署" value={p.department} />
            <Row label="先方担当者" value={p.clientContact} />
            <Row
              label="開発形態"
              value={
                p.developmentForm
                  ? DEVELOPMENT_FORM_LABELS[p.developmentForm as DevelopmentForm]
                  : undefined
              }
            />
            <OwnerRow
              projectId={p.id}
              label="自社営業"
              field="salesOwner"
              value={p.salesOwner}
              me={me}
            />
            <OwnerRow
              projectId={p.id}
              label="自社PM"
              field="pmOwner"
              value={p.pmOwner}
              me={me}
            />
            <OwnerRow
              projectId={p.id}
              label="プロジェクト責任者（P責）"
              field="projectLead"
              value={p.projectLead}
              me={me}
            />
            <Row label="想定予算" value={formatBudgetRange(p.budgetMin, p.budgetMax)} />
            <MonthlyBudgetRow
              projectId={p.id}
              monthlyRate={p.monthlyRate}
              months={p.contractMonths}
            />
            <Row label="希望開始" value={formatDate(p.expectedStartDate)} />
            <Row label="希望納期" value={formatDate(p.expectedDeliveryDate)} />
          </dl>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <RecommendationsCard
          projectId={p.id}
          platform={p.recommendedPlatform}
          deployment={p.recommendedDeployment}
        />

        {p.note && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">案件メモ</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {p.note}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      </div>
    </div>
  );
}
