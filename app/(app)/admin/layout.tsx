import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { AdminNav } from "@/components/admin/admin-nav";
import { ShieldCheck } from "lucide-react";

/**
 * /admin console layout (handoff §3). Guarded: only roles with `admin.access`
 * (admin, manager) get in; everyone else is redirected to the dashboard. Renders
 * a dedicated left menu (AdminNav) beside the section content.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (!can(user.role, "admin.access")) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5 text-primary" />
        <h1 className="text-xl font-bold">管理コンソール</h1>
      </div>

      <div className="flex flex-col gap-5 md:flex-row md:gap-6">
        <aside className="shrink-0 md:w-52 md:border-r md:pr-2">
          <AdminNav role={user.role} />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
