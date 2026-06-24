import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  EstimateEditor,
  type EstimateData,
} from "@/components/estimates/estimate-editor";
import { ConsistencyNotice } from "@/components/estimates/consistency-notice";

// AI生成は最長~120秒。Server Actionのタイムアウト既定値をページ単位で
// 引き上げる（Vercel Pro: 最大300秒）。
export const maxDuration = 300;


export default async function EstimatePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const [latest, design, consistency] = await Promise.all([
    db.estimates.getLatest(user.orgId, projectId),
    db.screenDesign.getLatest(user.orgId, projectId),
    db.consistency.getLatest(user.orgId, projectId),
  ]);

  // Estimate adjustments don't touch 画面設計/要件定義, so flag when the estimate
  // is newer than the last consistency check (and a design exists to drift from).
  // Both timestamps come from the same `ts()` column, so a string compare is a
  // safe ordering (and avoids new Date() choking on the `+00` offset).
  const showNotice =
    !!latest &&
    !!design &&
    (latest.estimate.createdAt ?? "") > (consistency?.createdAt ?? "");

  const estimate: EstimateData | null = latest
    ? {
        id: latest.estimate.id,
        estimateName: latest.estimate.estimateName,
        defaultUnitPrice: latest.estimate.defaultUnitPrice,
        bufferRate: latest.estimate.bufferRate,
        taxRate: latest.estimate.taxRate,
        version: latest.estimate.version,
        items: latest.items.map((i) => ({
          category: i.category ?? i.phase ?? "その他",
          subCategory: i.subCategory ?? "",
          role: i.role ?? "",
          taskName: i.taskName,
          approach: i.approach ?? "",
          purpose: i.purpose ?? "",
          hoursDesign: i.hoursDesign,
          hoursImpl: i.hoursImpl,
          hoursTest: i.hoursTest,
          hoursCoord: i.hoursCoord,
          hoursMgmt: i.hoursMgmt,
          unitPrice: i.unitPrice,
        })),
      }
    : null;

  return (
    <div className="space-y-4">
      {showNotice && <ConsistencyNotice projectId={projectId} />}
      <EstimateEditor
        key={latest ? latest.estimate.id : "empty"}
        projectId={projectId}
        estimate={estimate}
      />
    </div>
  );
}
