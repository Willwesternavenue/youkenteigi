import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  EstimateEditor,
  type EstimateData,
} from "@/components/estimates/estimate-editor";

export default async function EstimatePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const latest = await db.estimates.getLatest(user.orgId, projectId);

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
    <EstimateEditor
      key={latest ? latest.estimate.id : "empty"}
      projectId={projectId}
      estimate={estimate}
    />
  );
}
