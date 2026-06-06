import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { exportEstimateXlsx } from "@/lib/export";
import { computeTotals, itemHours, itemAmount, hoursToDays } from "@/lib/estimate-calc";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ estimateId: string }> },
) {
  const user = await requireUser();
  const { estimateId } = await params;
  const data = await db.estimates.getById(user.orgId, estimateId);
  if (!data) return new Response("not found", { status: 404 });

  const { estimate, items } = data;
  const totals = computeTotals(items, estimate.bufferRate, estimate.taxRate);
  const result = await exportEstimateXlsx({
    title: estimate.estimateName,
    defaultUnitPrice: estimate.defaultUnitPrice,
    bufferRate: estimate.bufferRate,
    taxRate: estimate.taxRate,
    items: items.map((i) => ({
      category: i.category ?? i.phase ?? "その他",
      subCategory: i.subCategory,
      taskName: i.taskName,
      approach: i.approach,
      purpose: i.purpose,
      role: i.role,
      hoursDesign: i.hoursDesign,
      hoursImpl: i.hoursImpl,
      hoursTest: i.hoursTest,
      hoursCoord: i.hoursCoord,
      hoursMgmt: i.hoursMgmt,
      hours: itemHours(i),
      personDays: hoursToDays(itemHours(i)),
      amount: itemAmount(i),
    })),
    totals,
  });

  const filename = `${estimate.estimateName}_v${estimate.version}.xlsx`;
  return new Response(new Uint8Array(result.data), {
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="estimate.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Length": String(result.data.length),
    },
  });
}
