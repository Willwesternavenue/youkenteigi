import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { RateCardsTable, type RateCard } from "@/components/admin/rate-cards-table";
import type { Role } from "@/types/domain";

export default async function AdminRateCardsPage() {
  const user = await requireUser();
  if (!can(user.role, "admin.ratecard")) redirect("/admin");

  const rows = await db.rateCards.list(user.orgId);
  const cards: RateCard[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role as Role,
    dailyRate: r.dailyRate,
    monthlyRate: r.monthlyRate ?? null,
    validFrom: r.validFrom ?? null,
    validTo: r.validTo ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">レートカード</h2>
        <p className="text-sm text-muted-foreground">
          役割別の人日／月額単価を管理します。見積を生成すると、各行の役割に対応する人日単価がここから自動適用されます（役割ごとに最新の登録を使用）。
        </p>
      </div>
      <RateCardsTable rows={cards} />
    </div>
  );
}
