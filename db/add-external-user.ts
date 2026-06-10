import { db } from "../lib/db";
import { ROLES, type Role } from "../types/domain";

// Mirror lib/auth.ts (which is server-only and can't be imported from a script).
const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN ?? "aidealab.com";

/**
 * Idempotently provision a single external collaborator (e.g. a client on
 * Gmail) into the org as a given role. SAFE for production — only touches the
 * one profile identified by email. Their address must ALSO be in the
 * ALLOWED_EMAILS env var for login to succeed (see lib/auth.ts).
 *
 *   npx tsx --env-file-if-exists=.env.local db/add-external-user.ts <email> [role]
 */
async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  const role = (process.argv[3] ?? "viewer") as Role;
  if (!email || !email.includes("@")) {
    throw new Error("usage: add-external-user.ts <email> [role]");
  }
  if (!ROLES.includes(role)) {
    throw new Error(`invalid role '${role}'. one of: ${ROLES.join(", ")}`);
  }

  const org = await db.orgs.getByDomain(ALLOWED_DOMAIN);
  if (!org) throw new Error(`組織が見つかりません (domain=${ALLOWED_DOMAIN})`);

  const existing = await db.profiles.getByEmail(email);
  if (existing) {
    if (existing.role !== role) {
      await db.profiles.setRole(existing.organizationId, existing.id, role);
      console.log(`✓ updated ${email}: role ${existing.role} → ${role}`);
    } else {
      console.log(`= ${email} already exists with role ${role} (no change)`);
    }
  } else {
    const p = await db.profiles.create({ orgId: org.id, email, role });
    console.log(`✓ created ${email} as ${role} in ${org.name} (${p.id})`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("add-external-user failed:", err);
  process.exit(1);
});
