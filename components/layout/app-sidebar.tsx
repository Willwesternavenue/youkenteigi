"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  FilePlus2,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AIdeaLabLogo } from "@/components/brand/logo";
import { can } from "@/lib/rbac";
import type { Role } from "@/types/domain";

const NAV = [
  { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/projects", label: "案件一覧", icon: FolderKanban },
  { href: "/projects/new", label: "新規案件", icon: FilePlus2 },
];

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const nav = can(role, "admin.access")
    ? [...NAV, { href: "/admin", label: "管理コンソール", icon: ShieldCheck }]
    : NAV;
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
      <div className="px-5 py-5">
        <AIdeaLabLogo />
        <div className="mt-1.5 text-[10px] font-medium text-muted-foreground">
          要件定義書けるくん · Internal
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {nav.map((item) => {
          const active =
            item.href === "/projects"
              ? pathname === "/projects"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 text-[10px] leading-relaxed text-muted-foreground">
        プリセールス特化型
        <br />
        AI要件定義支援システム
      </div>
    </aside>
  );
}
