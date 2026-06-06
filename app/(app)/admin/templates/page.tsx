import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { TemplatesTable, type Template } from "@/components/admin/templates-table";
import type { TemplateType } from "@/types/domain";

export default async function AdminTemplatesPage() {
  const user = await requireUser();
  if (!can(user.role, "admin.templates")) redirect("/admin");

  const rows = await db.templates.list(user.orgId);
  const items: Template[] = rows.map((t) => ({
    id: t.id,
    type: t.type as TemplateType,
    name: t.name,
    body: t.content?.body ?? "",
    isDefault: t.isDefault,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">テンプレート</h2>
        <p className="text-sm text-muted-foreground">
          RFP・要件定義・提案の標準文言／章立てライブラリ。品質の平準化や生成のベースに使えます。
        </p>
      </div>
      <TemplatesTable rows={items} />
    </div>
  );
}
