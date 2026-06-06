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
  | "review.approve";

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
};

export function can(role: Role, permission: Permission): boolean {
  if (role === "admin") return true;
  return MATRIX[permission]?.includes(role) ?? false;
}
