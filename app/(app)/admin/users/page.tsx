import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { UsersTable, type AdminUser } from "@/components/admin/users-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PERMISSION_MATRIX,
  PERMISSION_LABELS,
  PERMISSION_ORDER,
} from "@/lib/rbac";
import { ROLES, ROLE_LABELS, type Role } from "@/types/domain";
import { Check } from "lucide-react";

export default async function AdminUsersPage() {
  const user = await requireUser();
  if (!can(user.role, "admin.users")) redirect("/admin");

  const profiles = await db.profiles.listByOrg(user.orgId);
  const users: AdminUser[] = profiles.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    role: p.role as Role,
    disabled: p.disabled,
    lastLoginAt: p.lastLoginAt,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">ユーザー・ロール</h2>
        <p className="text-sm text-muted-foreground">
          メンバーの招待、ロールの変更、無効化/再有効化を行います。
        </p>
      </div>

      <UsersTable users={users} currentUserId={user.userId} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">権限マトリクス（RBAC）</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3 text-left font-medium">操作</th>
                {ROLES.map((r) => (
                  <th
                    key={r}
                    className="px-2 py-2 text-center font-medium whitespace-nowrap"
                  >
                    {ROLE_LABELS[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_ORDER.map((perm) => {
                const allowed = PERMISSION_MATRIX[perm];
                return (
                  <tr key={perm} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {PERMISSION_LABELS[perm]}
                    </td>
                    {ROLES.map((r) => {
                      // admin is allowed everything implicitly (see can()).
                      const ok = r === "admin" || allowed.includes(r);
                      return (
                        <td key={r} className="px-2 py-2 text-center">
                          {ok ? (
                            <Check className="mx-auto size-4 text-primary" />
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
