import type { Role } from "@/types/domain";

/**
 * Role-based access control.
 *
 * Permissions are coarse-grained action keys mapped to the roles allowed to
 * perform them, mirroring spec §4.4. `admin` is allowed everything implicitly.
 */

export type Permission =
  | "project.create"
  | "project.edit"
  | "project.status"
  | "hearing.edit"
  | "ai.generate"
  | "document.edit"
  | "document.export"
  | "review.comment"
  | "review.approve"
  // 管理画面 (/admin) — チーム導入・運用 (handoff §3.4)
  | "admin.access"
  | "admin.users"
  | "admin.org"
  | "admin.ratecard"
  | "admin.templates"
  | "admin.ai"
  | "admin.usage"
  | "admin.audit";

const MATRIX: Record<Permission, Role[]> = {
  "project.create": ["admin", "manager", "sales", "pm"],
  "project.edit": ["admin", "manager", "sales", "pm"],
  "project.status": ["admin", "manager", "pm"],
  "hearing.edit": ["admin", "manager", "sales", "pm"],
  "ai.generate": ["admin", "manager", "sales", "pm", "engineer"],
  "document.edit": ["admin", "manager", "sales", "pm", "engineer", "designer"],
  "document.export": [
    "admin",
    "manager",
    "sales",
    "pm",
    "engineer",
    "designer",
    "viewer",
  ],
  // peer review: everyone but read-only viewer can comment
  "review.comment": ["admin", "manager", "sales", "pm", "engineer", "designer"],
  // sign-off: managers/admin approve or send back (spec §4.4)
  "review.approve": ["admin", "manager"],
  // 管理画面: 機微な設定は admin 専用、運用寄り (レートカード/テンプレ/利用状況) は manager も
  "admin.access": ["admin", "manager"],
  "admin.users": ["admin"],
  "admin.org": ["admin"],
  "admin.ratecard": ["admin", "manager"],
  "admin.templates": ["admin", "manager"],
  "admin.ai": ["admin"],
  "admin.usage": ["admin", "manager"],
  "admin.audit": ["admin"],
};

export function can(role: Role, permission: Permission): boolean {
  if (role === "admin") return true;
  return MATRIX[permission]?.includes(role) ?? false;
}
