import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { AiSettingsForm } from "@/components/admin/ai-settings-form";

export default async function AdminAiPage() {
  const user = await requireUser();
  if (!can(user.role, "admin.ai")) redirect("/admin");

  const s = await db.aiSettings.get(user.orgId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">AI設定</h2>
        <p className="text-sm text-muted-foreground">
          プロバイダ・既定モデル・月次コスト上限など、組織のAI方針を設定します。
        </p>
      </div>
      <AiSettingsForm
        initial={{
          provider: s?.provider ?? "mock",
          defaultModel: s?.defaultModel ?? "",
          monthlyBudget: s?.monthlyBudget != null ? String(s.monthlyBudget) : "",
        }}
      />
    </div>
  );
}
