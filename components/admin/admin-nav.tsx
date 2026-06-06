"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Calculator,
  FileText,
  Bot,
  BarChart3,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { can, type Permission } from "@/lib/rbac";
import type { Role } from "@/types/domain";

/**
 * Left menu for the /admin console. Sections are gated by permission (managers
 * see the operational ones; everything else is admin-only). Sections that
 * aren't built yet render as muted "準備中" entries so the roadmap is visible
 * without dead links. Flip `ready` to true as each slice lands (handoff §3.6).
 */
interface AdminSection {
  seg: string; // path under /admin ("" = the dashboard root)
  label: string;
  icon: LucideIcon;
  permission: Permission;
  ready: boolean;
}

export const ADMIN_SECTIONS: AdminSection[] = [
  { seg: "", label: "管理ダッシュボード", icon: LayoutDashboard, permission: "admin.access", ready: true },
  { seg: "users", label: "ユーザー・ロール", icon: Users, permission: "admin.users", ready: true },
  { seg: "org", label: "組織設定", icon: Building2, permission: "admin.org", ready: false },
  { seg: "rate-cards", label: "レートカード", icon: Calculator, permission: "admin.ratecard", ready: false },
  { seg: "templates", label: "テンプレート", icon: FileText, permission: "admin.templates", ready: false },
  { seg: "ai", label: "AI設定", icon: Bot, permission: "admin.ai", ready: false },
  { seg: "usage", label: "利用状況・コスト", icon: BarChart3, permission: "admin.usage", ready: false },
  { seg: "audit", label: "監査ログ", icon: ScrollText, permission: "admin.audit", ready: false },
];

const hrefFor = (seg: string) => (seg ? `/admin/${seg}` : "/admin");

export function AdminNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const visible = ADMIN_SECTIONS.filter((s) => can(role, s.permission));

  return (
    <nav className="space-y-1">
      {visible.map((s) => {
        const href = hrefFor(s.seg);
        const active = s.seg === "" ? pathname === "/admin" : pathname.startsWith(href);
        const Icon = s.icon;

        if (!s.ready) {
          return (
            <div
              key={href}
              className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground/50"
              title="準備中"
            >
              <span className="flex items-center gap-2.5">
                <Icon className="size-4" />
                {s.label}
              </span>
              <span className="text-[10px]">準備中</span>
            </div>
          );
        }

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-foreground/70 hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
