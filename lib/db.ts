import { and, desc, eq } from "drizzle-orm";
import { database } from "@/db/client";
import {
  organizations,
  profiles,
  projects,
  hearings,
  files,
  scopePlans,
  decks,
  qualityReports,
  consistencyReports,
  comments,
  approvals,
  documents,
  estimates,
  estimateItems,
  schedules,
  scheduleTasks,
  milestones,
  screenDesigns,
  screens,
  screenTransitions,
  rateCards,
  templates,
  aiSettings,
  aiUsage,
  auditLogs,
  type ProjectRow,
  type ProfileRow,
  type OrganizationRow,
  type HearingRow,
  type FileRow,
  type DocumentRow,
  type CommentRow,
  type ApprovalRow,
  type EstimateRow,
  type EstimateItemRow,
  type ScheduleRow,
  type ScheduleTaskRow,
  type MilestoneRow,
  type ScreenDesignRow,
  type ScreenRow,
  type ScreenTransitionRow,
  type RateCardRow,
  type TemplateRow,
  type AiSettingsRow,
  type AiUsageRow,
} from "@/db/schema";
import type { DocumentType, ProjectStatus, Role } from "@/types/domain";
import type {
  OrganizedHearing,
  DocSection,
  GeneratedDesign,
  ScopeWbsPlan,
  ConsistencyReport,
  QualityReport,
} from "@/lib/ai/providers";
import { computeTotals, itemAmount, itemHours, hoursToDays } from "@/lib/estimate-calc";

/**
 * Repository facade. App / route / action code imports ONLY this module to
 * read or write data — never the driver or Drizzle directly. Every
 * tenant-scoped method takes `orgId` first and filters by it, so tenant
 * isolation is enforced here rather than in each route.
 */

const uid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

// ---------- organizations ----------

const orgs = {
  getById(id: string): Promise<OrganizationRow | undefined> {
    return database.query.organizations.findFirst({
      where: eq(organizations.id, id),
    });
  },
  getByDomain(domain: string): Promise<OrganizationRow | undefined> {
    return database.query.organizations.findFirst({
      where: eq(organizations.emailDomain, domain),
    });
  },
};

// ---------- profiles ----------

const profilesRepo = {
  getById(id: string): Promise<ProfileRow | undefined> {
    return database.query.profiles.findFirst({ where: eq(profiles.id, id) });
  },
  getByEmail(email: string): Promise<ProfileRow | undefined> {
    return database.query.profiles.findFirst({
      where: eq(profiles.email, email.toLowerCase()),
    });
  },
  async create(input: {
    orgId: string;
    email: string;
    name?: string;
    role?: Role;
  }): Promise<ProfileRow> {
    const row = {
      id: uid(),
      organizationId: input.orgId,
      email: input.email.toLowerCase(),
      name: input.name ?? input.email.split("@")[0],
      role: input.role ?? "viewer",
    };
    await database.insert(profiles).values(row);
    const created = await profilesRepo.getById(row.id);
    return created!;
  },
  listByOrg(orgId: string): Promise<ProfileRow[]> {
    return database.query.profiles.findMany({
      where: eq(profiles.organizationId, orgId),
      orderBy: [profiles.createdAt],
    });
  },
  // 招待 = profile を事前作成。初回ログイン時にこのロールが適用される
  // (signIn は getByEmail を先に見るため)。
  async invite(input: {
    orgId: string;
    email: string;
    name?: string;
    role: Role;
  }): Promise<ProfileRow> {
    return profilesRepo.create(input);
  },
  async setRole(orgId: string, userId: string, role: Role): Promise<void> {
    await database
      .update(profiles)
      .set({ role, updatedAt: nowIso() })
      .where(
        and(eq(profiles.organizationId, orgId), eq(profiles.id, userId)),
      );
  },
  async setDisabled(
    orgId: string,
    userId: string,
    disabled: boolean,
  ): Promise<void> {
    await database
      .update(profiles)
      .set({ disabled, updatedAt: nowIso() })
      .where(
        and(eq(profiles.organizationId, orgId), eq(profiles.id, userId)),
      );
  },
  async recordLogin(userId: string): Promise<void> {
    await database
      .update(profiles)
      .set({ lastLoginAt: nowIso() })
      .where(eq(profiles.id, userId));
  },
};

// ---------- projects ----------

export interface NewProjectInput {
  clientName: string;
  projectName: string;
  clientDomain?: string;
  industry?: string;
  department?: string;
  clientContact?: string;
  salesOwner?: string;
  pmOwner?: string;
  projectLead?: string;
  budgetMin?: number;
  budgetMax?: number;
  monthlyRate?: number;
  contractMonths?: number;
  expectedStartDate?: string;
  expectedDeliveryDate?: string;
  proposalDueDate?: string;
  developmentForm?: string;
  projectStage?: string;
  recommendedPlatform?: string;
  recommendedDeployment?: string;
  description?: string;
  links?: { label: string; url: string }[];
  meetingNotes?: { date: string; title: string; url: string }[];
  receivedMaterials?: { date: string; name: string; url: string }[];
  referenceLinks?: { title: string; url: string; note: string }[];
  note?: string;
}

export interface DashboardCounts {
  total: number;
  byStatus: Record<string, number>;
  budgetTotal: number;
  mine: number;
}

const projectsRepo = {
  list(orgId: string): Promise<ProjectRow[]> {
    return database.query.projects.findMany({
      where: eq(projects.organizationId, orgId),
      orderBy: [desc(projects.updatedAt)],
    });
  },
  getById(orgId: string, id: string): Promise<ProjectRow | undefined> {
    return database.query.projects.findFirst({
      where: and(eq(projects.organizationId, orgId), eq(projects.id, id)),
    });
  },
  async create(
    orgId: string,
    input: NewProjectInput,
    createdBy: string,
  ): Promise<ProjectRow> {
    const id = uid();
    await database.insert(projects).values({
      id,
      organizationId: orgId,
      clientName: input.clientName,
      projectName: input.projectName,
      clientDomain: input.clientDomain,
      industry: input.industry,
      department: input.department,
      clientContact: input.clientContact,
      salesOwner: input.salesOwner,
      pmOwner: input.pmOwner,
      projectLead: input.projectLead,
      budgetMin: input.budgetMin,
      budgetMax: input.budgetMax,
      monthlyRate: input.monthlyRate,
      contractMonths: input.contractMonths,
      expectedStartDate: input.expectedStartDate,
      expectedDeliveryDate: input.expectedDeliveryDate,
      proposalDueDate: input.proposalDueDate,
      developmentForm: input.developmentForm ?? "quasi_mandate",
      projectStage: input.projectStage,
      description: input.description,
      links: input.links,
      meetingNotes: input.meetingNotes,
      receivedMaterials: input.receivedMaterials,
      referenceLinks: input.referenceLinks,
      note: input.note,
      ownerId: createdBy,
      createdBy,
    });
    const created = await projectsRepo.getById(orgId, id);
    return created!;
  },
  async update(
    orgId: string,
    id: string,
    patch: Partial<NewProjectInput>,
  ): Promise<void> {
    await database
      .update(projects)
      .set({ ...patch, updatedAt: nowIso() })
      .where(and(eq(projects.organizationId, orgId), eq(projects.id, id)));
  },
  async setStatus(
    orgId: string,
    id: string,
    status: ProjectStatus,
  ): Promise<void> {
    await database
      .update(projects)
      .set({ status, updatedAt: nowIso() })
      .where(and(eq(projects.organizationId, orgId), eq(projects.id, id)));
  },
  async setRecommendations(
    orgId: string,
    id: string,
    rec: {
      recommendedPhase?: string;
      recommendedPlatform?: string;
      recommendedDeployment?: string;
    },
  ): Promise<void> {
    await database
      .update(projects)
      .set({ ...rec, updatedAt: nowIso() })
      .where(and(eq(projects.organizationId, orgId), eq(projects.id, id)));
  },
  async dashboardCounts(
    orgId: string,
    userId: string,
  ): Promise<DashboardCounts> {
    const rows = await projectsRepo.list(orgId);
    const byStatus: Record<string, number> = {};
    let budgetTotal = 0;
    let mine = 0;
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      budgetTotal += r.budgetMax ?? r.budgetMin ?? 0;
      if (r.ownerId === userId) mine += 1;
    }
    return { total: rows.length, byStatus, budgetTotal, mine };
  },
};

// ---------- hearings (slice = one hearing per project) ----------

const hearingsRepo = {
  getByProject(
    orgId: string,
    projectId: string,
  ): Promise<HearingRow | undefined> {
    return database.query.hearings.findFirst({
      where: and(
        eq(hearings.organizationId, orgId),
        eq(hearings.projectId, projectId),
      ),
    });
  },
  async upsert(
    orgId: string,
    projectId: string,
    input: {
      rawText: string;
      meetingDate?: string;
      meetingTime?: string;
      meetingFormat?: string;
      clientParticipants?: string;
      ourParticipants?: string;
      sourceType?: string;
    },
    userId: string,
  ): Promise<HearingRow> {
    const existing = await hearingsRepo.getByProject(orgId, projectId);
    if (existing) {
      await database
        .update(hearings)
        .set({
          rawText: input.rawText,
          meetingDate: input.meetingDate,
          meetingTime: input.meetingTime,
          meetingFormat: input.meetingFormat,
          clientParticipants: input.clientParticipants,
          ourParticipants: input.ourParticipants,
          sourceType: input.sourceType ?? "text",
          updatedAt: nowIso(),
        })
        .where(eq(hearings.id, existing.id));
      return (await hearingsRepo.getByProject(orgId, projectId))!;
    }
    const id = uid();
    await database.insert(hearings).values({
      id,
      organizationId: orgId,
      projectId,
      rawText: input.rawText,
      meetingDate: input.meetingDate,
      meetingTime: input.meetingTime,
      meetingFormat: input.meetingFormat,
      clientParticipants: input.clientParticipants,
      ourParticipants: input.ourParticipants,
      sourceType: input.sourceType ?? "text",
      createdBy: userId,
    });
    return (await hearingsRepo.getByProject(orgId, projectId))!;
  },
  async saveOrganized(
    orgId: string,
    projectId: string,
    organized: OrganizedHearing,
  ): Promise<void> {
    const existing = await hearingsRepo.getByProject(orgId, projectId);
    if (!existing) return;
    await database
      .update(hearings)
      .set({
        summary: organized.summary,
        confirmedFacts: organized.confirmedFacts,
        assumptions: organized.assumptions,
        openQuestions: organized.openQuestions,
        risks: organized.risks,
        recommendedAiModel: organized.recommendedAiModel,
        organizedAt: nowIso(),
        updatedAt: nowIso(),
      })
      .where(eq(hearings.id, existing.id));
  },
};

// ---------- files (uploaded 録音/議事録/資料) ----------

export interface FileListItem {
  id: string;
  fileName: string;
  fileType: string | null;
  storagePath: string;
  createdAt: string;
  uploaderName: string | null;
}

const filesRepo = {
  listByProject(orgId: string, projectId: string): Promise<FileListItem[]> {
    return database
      .select({
        id: files.id,
        fileName: files.fileName,
        fileType: files.fileType,
        storagePath: files.storagePath,
        createdAt: files.createdAt,
        uploaderName: profiles.name,
      })
      .from(files)
      .leftJoin(profiles, eq(files.uploadedBy, profiles.id))
      .where(
        and(eq(files.organizationId, orgId), eq(files.projectId, projectId)),
      )
      .orderBy(desc(files.createdAt));
  },
  getById(orgId: string, id: string): Promise<FileRow | undefined> {
    return database.query.files.findFirst({
      where: and(eq(files.organizationId, orgId), eq(files.id, id)),
    });
  },
  async create(
    orgId: string,
    input: {
      projectId: string;
      fileName: string;
      fileType: string;
      storagePath: string;
      uploadedBy: string;
    },
  ): Promise<FileRow> {
    const id = uid();
    await database.insert(files).values({
      id,
      organizationId: orgId,
      projectId: input.projectId,
      fileName: input.fileName,
      fileType: input.fileType,
      storagePath: input.storagePath,
      uploadedBy: input.uploadedBy,
    });
    return (await filesRepo.getById(orgId, id))!;
  },
  async delete(orgId: string, id: string): Promise<void> {
    await database
      .delete(files)
      .where(and(eq(files.organizationId, orgId), eq(files.id, id)));
  },
};

// ---------- scope & WBS (engagement-type aware, append version) ----------

export interface ScopePlanData {
  version: number;
  developmentForm: string | null;
  plan: ScopeWbsPlan;
}

const scopeRepo = {
  async getLatest(
    orgId: string,
    projectId: string,
  ): Promise<ScopePlanData | null> {
    const row = await database.query.scopePlans.findFirst({
      where: and(
        eq(scopePlans.organizationId, orgId),
        eq(scopePlans.projectId, projectId),
      ),
      orderBy: [desc(scopePlans.version)],
    });
    if (!row || !row.plan) return null;
    return {
      version: row.version,
      developmentForm: row.developmentForm,
      plan: row.plan as ScopeWbsPlan,
    };
  },
  async saveVersion(
    orgId: string,
    projectId: string,
    plan: ScopeWbsPlan,
    developmentForm: string | null,
    userId: string,
  ): Promise<void> {
    const latest = await database.query.scopePlans.findFirst({
      where: and(
        eq(scopePlans.organizationId, orgId),
        eq(scopePlans.projectId, projectId),
      ),
      orderBy: [desc(scopePlans.version)],
    });
    await database.insert(scopePlans).values({
      id: uid(),
      organizationId: orgId,
      projectId,
      version: (latest?.version ?? 0) + 1,
      developmentForm,
      plan,
      createdBy: userId,
    });
  },
};

// ---------- decks (editable proposal slides, append version) ----------

const decksRepo = {
  async getLatest(
    orgId: string,
    projectId: string,
  ): Promise<{ version: number; slides: unknown[] } | null> {
    const row = await database.query.decks.findFirst({
      where: and(
        eq(decks.organizationId, orgId),
        eq(decks.projectId, projectId),
      ),
      orderBy: [desc(decks.version)],
    });
    if (!row || !row.slides) return null;
    return { version: row.version, slides: row.slides as unknown[] };
  },
  async saveVersion(
    orgId: string,
    projectId: string,
    slides: unknown[],
    userId: string,
  ): Promise<void> {
    const latest = await database.query.decks.findFirst({
      where: and(
        eq(decks.organizationId, orgId),
        eq(decks.projectId, projectId),
      ),
      orderBy: [desc(decks.version)],
    });
    await database.insert(decks).values({
      id: uid(),
      organizationId: orgId,
      projectId,
      version: (latest?.version ?? 0) + 1,
      slides,
      createdBy: userId,
    });
  },
};

// ---------- quality reports (requirements-doc quality review) ----------

export interface QualityData {
  version: number;
  report: QualityReport;
  createdAt: string;
}

const qualityRepo = {
  async getLatest(
    orgId: string,
    projectId: string,
  ): Promise<QualityData | null> {
    const row = await database.query.qualityReports.findFirst({
      where: and(
        eq(qualityReports.organizationId, orgId),
        eq(qualityReports.projectId, projectId),
      ),
      orderBy: [desc(qualityReports.version)],
    });
    if (!row || !row.report) return null;
    return {
      version: row.version,
      report: row.report as QualityReport,
      createdAt: row.createdAt,
    };
  },
  async saveVersion(
    orgId: string,
    projectId: string,
    report: QualityReport,
    userId: string,
  ): Promise<void> {
    const latest = await database.query.qualityReports.findFirst({
      where: and(
        eq(qualityReports.organizationId, orgId),
        eq(qualityReports.projectId, projectId),
      ),
      orderBy: [desc(qualityReports.version)],
    });
    await database.insert(qualityReports).values({
      id: uid(),
      organizationId: orgId,
      projectId,
      version: (latest?.version ?? 0) + 1,
      report,
      createdBy: userId,
    });
  },
  async updateLatest(
    orgId: string,
    projectId: string,
    report: QualityReport,
  ): Promise<void> {
    const latest = await database.query.qualityReports.findFirst({
      where: and(
        eq(qualityReports.organizationId, orgId),
        eq(qualityReports.projectId, projectId),
      ),
      orderBy: [desc(qualityReports.version)],
    });
    if (!latest) return;
    await database
      .update(qualityReports)
      .set({ report })
      .where(eq(qualityReports.id, latest.id));
  },
};

// ---------- consistency reports (cross-artifact AI review) ----------

export interface ConsistencyData {
  version: number;
  report: ConsistencyReport;
  createdAt: string;
}

const consistencyRepo = {
  async getLatest(
    orgId: string,
    projectId: string,
  ): Promise<ConsistencyData | null> {
    const row = await database.query.consistencyReports.findFirst({
      where: and(
        eq(consistencyReports.organizationId, orgId),
        eq(consistencyReports.projectId, projectId),
      ),
      orderBy: [desc(consistencyReports.version)],
    });
    if (!row || !row.report) return null;
    return {
      version: row.version,
      report: row.report as ConsistencyReport,
      createdAt: row.createdAt,
    };
  },
  async saveVersion(
    orgId: string,
    projectId: string,
    report: ConsistencyReport,
    userId: string,
  ): Promise<void> {
    const latest = await database.query.consistencyReports.findFirst({
      where: and(
        eq(consistencyReports.organizationId, orgId),
        eq(consistencyReports.projectId, projectId),
      ),
      orderBy: [desc(consistencyReports.version)],
    });
    await database.insert(consistencyReports).values({
      id: uid(),
      organizationId: orgId,
      projectId,
      version: (latest?.version ?? 0) + 1,
      report,
      createdBy: userId,
    });
  },
  /** Update the latest report in place (e.g. toggling a finding's resolved mark). */
  async updateLatest(
    orgId: string,
    projectId: string,
    report: ConsistencyReport,
  ): Promise<void> {
    const latest = await database.query.consistencyReports.findFirst({
      where: and(
        eq(consistencyReports.organizationId, orgId),
        eq(consistencyReports.projectId, projectId),
      ),
      orderBy: [desc(consistencyReports.version)],
    });
    if (!latest) return;
    await database
      .update(consistencyReports)
      .set({ report })
      .where(eq(consistencyReports.id, latest.id));
  },
};

// ---------- review: comments + approvals (peer review & sign-off) ----------

export interface ReviewFeedItem {
  kind: "comment" | "approval";
  id: string;
  authorName: string | null;
  authorRole: string | null;
  /** comment_type (comment) or status approved/rejected (approval) */
  variant: string | null;
  body: string;
  createdAt: string;
  /** comments only: "open" | "resolved" (対応済み) */
  status?: string | null;
}

export interface ApprovalSummary {
  approved: number;
  rejected: number;
  approvers: { name: string | null; role: string | null; status: string }[];
}

const reviewRepo = {
  async feed(orgId: string, projectId: string): Promise<ReviewFeedItem[]> {
    const cRows = await database
      .select({
        id: comments.id,
        body: comments.body,
        variant: comments.commentType,
        status: comments.status,
        createdAt: comments.createdAt,
        name: profiles.name,
        role: profiles.role,
      })
      .from(comments)
      .leftJoin(profiles, eq(comments.commenterId, profiles.id))
      .where(
        and(
          eq(comments.organizationId, orgId),
          eq(comments.projectId, projectId),
        ),
      );
    const aRows = await database
      .select({
        id: approvals.id,
        comment: approvals.comment,
        status: approvals.status,
        createdAt: approvals.createdAt,
        name: profiles.name,
        role: profiles.role,
      })
      .from(approvals)
      .leftJoin(profiles, eq(approvals.approverId, profiles.id))
      .where(
        and(
          eq(approvals.organizationId, orgId),
          eq(approvals.projectId, projectId),
        ),
      );

    const items: ReviewFeedItem[] = [
      ...cRows.map((r) => ({
        kind: "comment" as const,
        id: r.id,
        authorName: r.name,
        authorRole: r.role,
        variant: r.variant,
        body: r.body,
        createdAt: r.createdAt,
        status: r.status,
      })),
      ...aRows.map((r) => ({
        kind: "approval" as const,
        id: r.id,
        authorName: r.name,
        authorRole: r.role,
        variant: r.status,
        body: r.comment ?? "",
        createdAt: r.createdAt,
      })),
    ];
    // newest first
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async summary(orgId: string, projectId: string): Promise<ApprovalSummary> {
    const rows = await database
      .select({
        status: approvals.status,
        createdAt: approvals.createdAt,
        approverId: approvals.approverId,
        name: profiles.name,
        role: profiles.role,
      })
      .from(approvals)
      .leftJoin(profiles, eq(approvals.approverId, profiles.id))
      .where(
        and(
          eq(approvals.organizationId, orgId),
          eq(approvals.projectId, projectId),
        ),
      )
      .orderBy(desc(approvals.createdAt));
    // latest decision per approver
    const latest = new Map<
      string,
      { name: string | null; role: string | null; status: string }
    >();
    let anon = 0;
    for (const r of rows) {
      const k = r.approverId ?? `anon-${anon++}`;
      if (!latest.has(k))
        latest.set(k, {
          name: r.name,
          role: r.role,
          status: r.status ?? "pending",
        });
    }
    const approvers = Array.from(latest.values());
    return {
      approved: approvers.filter((a) => a.status === "approved").length,
      rejected: approvers.filter((a) => a.status === "rejected").length,
      approvers,
    };
  },

  async addComment(
    orgId: string,
    input: {
      projectId: string;
      commenterId: string;
      commentType: string;
      body: string;
    },
  ): Promise<CommentRow> {
    const id = uid();
    await database.insert(comments).values({
      id,
      organizationId: orgId,
      projectId: input.projectId,
      targetType: "project",
      commenterId: input.commenterId,
      commentType: input.commentType,
      body: input.body,
    });
    return (await database.query.comments.findFirst({
      where: eq(comments.id, id),
    }))!;
  },

  async addApproval(
    orgId: string,
    input: {
      projectId: string;
      approverId: string;
      status: string;
      comment?: string;
    },
  ): Promise<ApprovalRow> {
    const id = uid();
    await database.insert(approvals).values({
      id,
      organizationId: orgId,
      projectId: input.projectId,
      targetType: "project",
      approverId: input.approverId,
      status: input.status,
      comment: input.comment,
      approvedAt: input.status === "approved" ? nowIso() : null,
    });
    return (await database.query.approvals.findFirst({
      where: eq(approvals.id, id),
    }))!;
  },

  async setCommentStatus(
    orgId: string,
    commentId: string,
    status: string,
  ): Promise<void> {
    await database
      .update(comments)
      .set({ status, updatedAt: nowIso() })
      .where(
        and(eq(comments.organizationId, orgId), eq(comments.id, commentId)),
      );
  },
};

// ---------- documents (append-only version history) ----------

const documentsRepo = {
  getLatest(
    orgId: string,
    projectId: string,
    type: DocumentType,
  ): Promise<DocumentRow | undefined> {
    return database.query.documents.findFirst({
      where: and(
        eq(documents.organizationId, orgId),
        eq(documents.projectId, projectId),
        eq(documents.documentType, type),
      ),
      orderBy: [desc(documents.version)],
    });
  },
  getById(orgId: string, id: string): Promise<DocumentRow | undefined> {
    return database.query.documents.findFirst({
      where: and(eq(documents.organizationId, orgId), eq(documents.id, id)),
    });
  },
  listVersions(
    orgId: string,
    projectId: string,
    type: DocumentType,
  ): Promise<DocumentRow[]> {
    return database.query.documents.findMany({
      where: and(
        eq(documents.organizationId, orgId),
        eq(documents.projectId, projectId),
        eq(documents.documentType, type),
      ),
      orderBy: [desc(documents.version)],
    });
  },
  async saveVersion(
    orgId: string,
    projectId: string,
    type: DocumentType,
    input: { title: string; sections: DocSection[]; createdBy: string },
  ): Promise<DocumentRow> {
    const latest = await documentsRepo.getLatest(orgId, projectId, type);
    const version = (latest?.version ?? 0) + 1;
    const id = uid();
    const contentMarkdown = input.sections
      .map((s) => `## ${s.heading}\n\n${s.markdown}`)
      .join("\n\n");
    await database.insert(documents).values({
      id,
      organizationId: orgId,
      projectId,
      documentType: type,
      title: input.title,
      contentMarkdown,
      contentJson: input.sections,
      version,
      createdBy: input.createdBy,
    });
    return (await documentsRepo.getById(orgId, id))!;
  },
};

// ---------- estimates (append-only versions) ----------

export interface EstimateInput {
  estimateName: string;
  defaultUnitPrice: number;
  bufferRate: number;
  taxRate: number;
  items: {
    category?: string;
    subCategory?: string;
    role?: string;
    taskName: string;
    approach?: string;
    purpose?: string;
    hoursDesign: number;
    hoursImpl: number;
    hoursTest: number;
    hoursCoord: number;
    hoursMgmt: number;
    unitPrice: number;
  }[];
  createdBy: string;
}

export interface EstimateWithItems {
  estimate: EstimateRow;
  items: EstimateItemRow[];
}

const estimatesRepo = {
  async getLatest(
    orgId: string,
    projectId: string,
  ): Promise<EstimateWithItems | null> {
    const estimate = await database.query.estimates.findFirst({
      where: and(
        eq(estimates.organizationId, orgId),
        eq(estimates.projectId, projectId),
      ),
      orderBy: [desc(estimates.version)],
    });
    if (!estimate) return null;
    const items = await estimatesRepo.itemsFor(orgId, estimate.id);
    return { estimate, items };
  },
  async getById(
    orgId: string,
    estimateId: string,
  ): Promise<EstimateWithItems | null> {
    const estimate = await database.query.estimates.findFirst({
      where: and(
        eq(estimates.organizationId, orgId),
        eq(estimates.id, estimateId),
      ),
    });
    if (!estimate) return null;
    const items = await estimatesRepo.itemsFor(orgId, estimate.id);
    return { estimate, items };
  },
  itemsFor(orgId: string, estimateId: string): Promise<EstimateItemRow[]> {
    return database.query.estimateItems.findMany({
      where: and(
        eq(estimateItems.organizationId, orgId),
        eq(estimateItems.estimateId, estimateId),
      ),
      orderBy: [estimateItems.sortOrder],
    });
  },
  async saveVersion(
    orgId: string,
    projectId: string,
    input: EstimateInput,
  ): Promise<EstimateWithItems> {
    const latest = await database.query.estimates.findFirst({
      where: and(
        eq(estimates.organizationId, orgId),
        eq(estimates.projectId, projectId),
      ),
      orderBy: [desc(estimates.version)],
    });
    const version = (latest?.version ?? 0) + 1;
    const totals = computeTotals(input.items, input.bufferRate, input.taxRate);
    const estimateId = uid();
    await database.insert(estimates).values({
      id: estimateId,
      organizationId: orgId,
      projectId,
      estimateName: input.estimateName,
      defaultUnitPrice: input.defaultUnitPrice,
      bufferRate: input.bufferRate,
      taxRate: input.taxRate,
      subtotal: totals.subtotal,
      buffer: totals.buffer,
      tax: totals.tax,
      total: totals.total,
      version,
      createdBy: input.createdBy,
    });
    if (input.items.length) {
      await database.insert(estimateItems).values(
        input.items.map((it, idx) => {
          const hours = itemHours(it);
          return {
            id: uid(),
            organizationId: orgId,
            estimateId,
            projectId,
            category: it.category,
            subCategory: it.subCategory,
            phase: it.category,
            role: it.role,
            taskName: it.taskName,
            approach: it.approach,
            purpose: it.purpose,
            hoursDesign: it.hoursDesign,
            hoursImpl: it.hoursImpl,
            hoursTest: it.hoursTest,
            hoursCoord: it.hoursCoord,
            hoursMgmt: it.hoursMgmt,
            personDays: hoursToDays(hours),
            unitPrice: it.unitPrice,
            amount: itemAmount(it),
            sortOrder: idx,
          };
        }),
      );
    }
    return (await estimatesRepo.getById(orgId, estimateId))!;
  },
};

// ---------- schedules (append-only versions) ----------

export interface ScheduleTaskInput {
  taskKey: string;
  taskName: string;
  phase: string;
  description?: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  assigneeRole?: string | null;
  dependencyTaskKeys: string[];
  isCriticalPath: boolean;
  needsClientReview?: boolean | null;
  risk?: string | null;
}

export interface MilestoneInput {
  title: string;
  description?: string;
  milestoneDate: string;
  milestoneType?: string;
  isClientVisible?: boolean;
}

export interface ScheduleInput {
  scheduleName: string;
  startDate: string;
  endDate: string;
  tasks: ScheduleTaskInput[];
  milestones: MilestoneInput[];
  nonWorkingPeriods?: { name: string; start: string; end: string }[];
  createdBy: string;
}

export interface ScheduleWithTasks {
  schedule: ScheduleRow;
  tasks: ScheduleTaskRow[];
  milestones: MilestoneRow[];
}

const schedulesRepo = {
  async getLatest(
    orgId: string,
    projectId: string,
  ): Promise<ScheduleWithTasks | null> {
    const schedule = await database.query.schedules.findFirst({
      where: and(
        eq(schedules.organizationId, orgId),
        eq(schedules.projectId, projectId),
      ),
      orderBy: [desc(schedules.version)],
    });
    if (!schedule) return null;
    return schedulesRepo.hydrate(orgId, schedule);
  },
  async getById(
    orgId: string,
    scheduleId: string,
  ): Promise<ScheduleWithTasks | null> {
    const schedule = await database.query.schedules.findFirst({
      where: and(
        eq(schedules.organizationId, orgId),
        eq(schedules.id, scheduleId),
      ),
    });
    if (!schedule) return null;
    return schedulesRepo.hydrate(orgId, schedule);
  },
  async hydrate(
    orgId: string,
    schedule: ScheduleRow,
  ): Promise<ScheduleWithTasks> {
    const tasks = await database.query.scheduleTasks.findMany({
      where: and(
        eq(scheduleTasks.organizationId, orgId),
        eq(scheduleTasks.scheduleId, schedule.id),
      ),
      orderBy: [scheduleTasks.sortOrder],
    });
    const ms = await database.query.milestones.findMany({
      where: and(
        eq(milestones.organizationId, orgId),
        eq(milestones.scheduleId, schedule.id),
      ),
    });
    return { schedule, tasks, milestones: ms };
  },
  async saveVersion(
    orgId: string,
    projectId: string,
    input: ScheduleInput,
  ): Promise<ScheduleWithTasks> {
    const latest = await database.query.schedules.findFirst({
      where: and(
        eq(schedules.organizationId, orgId),
        eq(schedules.projectId, projectId),
      ),
      orderBy: [desc(schedules.version)],
    });
    const version = (latest?.version ?? 0) + 1;
    const scheduleId = uid();
    await database.insert(schedules).values({
      id: scheduleId,
      organizationId: orgId,
      projectId,
      scheduleName: input.scheduleName,
      startDate: input.startDate,
      endDate: input.endDate,
      nonWorkingPeriods: input.nonWorkingPeriods ?? [],
      version,
      createdBy: input.createdBy,
    });
    if (input.tasks.length) {
      await database.insert(scheduleTasks).values(
        input.tasks.map((t, idx) => ({
          id: uid(),
          organizationId: orgId,
          scheduleId,
          projectId,
          taskKey: t.taskKey,
          taskName: t.taskName,
          phase: t.phase,
          description: t.description,
          startDate: t.startDate,
          endDate: t.endDate,
          durationDays: t.durationDays,
          assigneeRole: t.assigneeRole,
          dependencyTaskKeys: t.dependencyTaskKeys,
          isCriticalPath: t.isCriticalPath,
          needsClientReview: t.needsClientReview ?? false,
          risk: t.risk,
          sortOrder: idx,
        })),
      );
    }
    if (input.milestones.length) {
      await database.insert(milestones).values(
        input.milestones.map((m) => ({
          id: uid(),
          organizationId: orgId,
          scheduleId,
          projectId,
          title: m.title,
          description: m.description,
          milestoneDate: m.milestoneDate,
          milestoneType: m.milestoneType,
          isClientVisible: m.isClientVisible ?? true,
        })),
      );
    }
    return (await schedulesRepo.getById(orgId, scheduleId))!;
  },
};

// ---------- screen design (append-only versions) ----------

export interface ScreenDesignFull {
  design: ScreenDesignRow;
  screens: ScreenRow[];
  transitions: ScreenTransitionRow[];
}

const screenDesignRepo = {
  async getLatest(
    orgId: string,
    projectId: string,
  ): Promise<ScreenDesignFull | null> {
    const design = await database.query.screenDesigns.findFirst({
      where: and(
        eq(screenDesigns.organizationId, orgId),
        eq(screenDesigns.projectId, projectId),
      ),
      orderBy: [desc(screenDesigns.version)],
    });
    if (!design) return null;
    return screenDesignRepo.hydrate(orgId, design);
  },
  async getById(orgId: string, id: string): Promise<ScreenDesignFull | null> {
    const design = await database.query.screenDesigns.findFirst({
      where: and(
        eq(screenDesigns.organizationId, orgId),
        eq(screenDesigns.id, id),
      ),
    });
    if (!design) return null;
    return screenDesignRepo.hydrate(orgId, design);
  },
  async hydrate(
    orgId: string,
    design: ScreenDesignRow,
  ): Promise<ScreenDesignFull> {
    const scr = await database.query.screens.findMany({
      where: and(
        eq(screens.organizationId, orgId),
        eq(screens.screenDesignId, design.id),
      ),
      orderBy: [screens.sortOrder],
    });
    const tr = await database.query.screenTransitions.findMany({
      where: and(
        eq(screenTransitions.organizationId, orgId),
        eq(screenTransitions.screenDesignId, design.id),
      ),
    });
    return { design, screens: scr, transitions: tr };
  },
  async saveVersion(
    orgId: string,
    projectId: string,
    gen: GeneratedDesign,
    userId: string,
  ): Promise<ScreenDesignFull> {
    const latest = await database.query.screenDesigns.findFirst({
      where: and(
        eq(screenDesigns.organizationId, orgId),
        eq(screenDesigns.projectId, projectId),
      ),
      orderBy: [desc(screenDesigns.version)],
    });
    const version = (latest?.version ?? 0) + 1;
    const designId = uid();
    await database.insert(screenDesigns).values({
      id: designId,
      organizationId: orgId,
      projectId,
      version,
      architecture: gen.architecture,
      designPrompt: gen.designPrompt,
      createdBy: userId,
    });

    const keyToId = new Map<string, string>();
    if (gen.screens.length) {
      const rows = gen.screens.map((s, idx) => {
        const id = uid();
        keyToId.set(s.key, id);
        return {
          id,
          organizationId: orgId,
          screenDesignId: designId,
          projectId,
          screenKey: s.key,
          screenName: s.name,
          userRole: s.role,
          purpose: s.purpose,
          uiElements: s.uiElements,
          states: s.states,
          wireframe: s.wireframe,
          priority: s.priority,
          sortOrder: idx,
        };
      });
      await database.insert(screens).values(rows);
    }
    const validTransitions = gen.transitions.filter(
      (t) => keyToId.has(t.from) && keyToId.has(t.to),
    );
    if (validTransitions.length) {
      await database.insert(screenTransitions).values(
        validTransitions.map((t) => ({
          id: uid(),
          organizationId: orgId,
          screenDesignId: designId,
          projectId,
          fromScreenId: keyToId.get(t.from),
          toScreenId: keyToId.get(t.to),
          triggerAction: t.trigger,
          description: t.description,
        })),
      );
    }
    return (await screenDesignRepo.getById(orgId, designId))!;
  },
};

// ---------- admin console aggregations (handoff §3) ----------

export interface AdminUpcomingProposal {
  id: string;
  projectName: string;
  clientName: string;
  proposalDueDate: string;
  status: string;
}

export interface AdminDashboard {
  userCount: number;
  totalProjects: number;
  byStatus: Record<string, number>;
  budgetTotal: number;
  openComments: number;
  pendingApprovals: number;
  upcoming: AdminUpcomingProposal[];
}

const ACTIVE_PROJECT_STATUSES = new Set([
  "draft",
  "in_review",
  "approved",
  "submitted",
]);

const adminRepo = {
  // Cross-project, org-wide snapshot for the management dashboard.
  async dashboard(orgId: string): Promise<AdminDashboard> {
    const [projectRows, userRows, openCommentRows, pendingApprovalRows] =
      await Promise.all([
        projectsRepo.list(orgId),
        profilesRepo.listByOrg(orgId),
        database
          .select({ id: comments.id })
          .from(comments)
          .where(
            and(
              eq(comments.organizationId, orgId),
              eq(comments.status, "open"),
            ),
          ),
        database
          .select({ id: approvals.id })
          .from(approvals)
          .where(
            and(
              eq(approvals.organizationId, orgId),
              eq(approvals.status, "pending"),
            ),
          ),
      ]);

    const byStatus: Record<string, number> = {};
    let budgetTotal = 0;
    for (const r of projectRows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      budgetTotal += r.budgetMax ?? r.budgetMin ?? 0;
    }

    const upcoming = projectRows
      .filter(
        (p) =>
          !!p.proposalDueDate && ACTIVE_PROJECT_STATUSES.has(p.status),
      )
      .sort((a, b) =>
        (a.proposalDueDate ?? "").localeCompare(b.proposalDueDate ?? ""),
      )
      .slice(0, 8)
      .map((p) => ({
        id: p.id,
        projectName: p.projectName,
        clientName: p.clientName,
        proposalDueDate: p.proposalDueDate!,
        status: p.status,
      }));

    return {
      userCount: userRows.length,
      totalProjects: projectRows.length,
      byStatus,
      budgetTotal,
      openComments: openCommentRows.length,
      pendingApprovals: pendingApprovalRows.length,
      upcoming,
    };
  },
};

// ---------- admin: rate cards (CRUD only) ----------

export interface RateCardInput {
  name: string;
  role: string;
  dailyRate: number;
  monthlyRate?: number | null;
  validFrom?: string | null;
  validTo?: string | null;
}

const rateCardsRepo = {
  list(orgId: string): Promise<RateCardRow[]> {
    return database.query.rateCards.findMany({
      where: eq(rateCards.organizationId, orgId),
      orderBy: [rateCards.name, rateCards.role],
    });
  },
  async create(
    orgId: string,
    input: RateCardInput,
    createdBy: string,
  ): Promise<RateCardRow> {
    const id = uid();
    await database.insert(rateCards).values({
      id,
      organizationId: orgId,
      name: input.name,
      role: input.role,
      dailyRate: input.dailyRate,
      monthlyRate: input.monthlyRate ?? null,
      validFrom: input.validFrom ?? null,
      validTo: input.validTo ?? null,
      createdBy,
    });
    return (await database.query.rateCards.findFirst({
      where: and(eq(rateCards.organizationId, orgId), eq(rateCards.id, id)),
    }))!;
  },
  async update(
    orgId: string,
    id: string,
    patch: Partial<RateCardInput>,
  ): Promise<void> {
    await database
      .update(rateCards)
      .set({ ...patch, updatedAt: nowIso() })
      .where(and(eq(rateCards.organizationId, orgId), eq(rateCards.id, id)));
  },
  async delete(orgId: string, id: string): Promise<void> {
    await database
      .delete(rateCards)
      .where(and(eq(rateCards.organizationId, orgId), eq(rateCards.id, id)));
  },
};

// ---------- admin: templates (CRUD only) ----------

export interface TemplateInput {
  type: string;
  name: string;
  body: string;
  isDefault?: boolean;
}

const templatesRepo = {
  list(orgId: string): Promise<TemplateRow[]> {
    return database.query.templates.findMany({
      where: eq(templates.organizationId, orgId),
      orderBy: [templates.type, templates.name],
    });
  },
  async create(
    orgId: string,
    input: TemplateInput,
    createdBy: string,
  ): Promise<TemplateRow> {
    const id = uid();
    await database.insert(templates).values({
      id,
      organizationId: orgId,
      type: input.type,
      name: input.name,
      content: { body: input.body },
      isDefault: input.isDefault ?? false,
      createdBy,
    });
    return (await database.query.templates.findFirst({
      where: and(eq(templates.organizationId, orgId), eq(templates.id, id)),
    }))!;
  },
  async update(
    orgId: string,
    id: string,
    input: TemplateInput,
  ): Promise<void> {
    await database
      .update(templates)
      .set({
        type: input.type,
        name: input.name,
        content: { body: input.body },
        isDefault: input.isDefault ?? false,
        updatedAt: nowIso(),
      })
      .where(and(eq(templates.organizationId, orgId), eq(templates.id, id)));
  },
  async delete(orgId: string, id: string): Promise<void> {
    await database
      .delete(templates)
      .where(and(eq(templates.organizationId, orgId), eq(templates.id, id)));
  },
};

// ---------- admin: AI settings ----------

export interface AiSettingsInput {
  provider: string;
  defaultModel?: string | null;
  monthlyBudget?: number | null;
  promptOverrides?: Record<string, string> | null;
}

const aiSettingsRepo = {
  get(orgId: string): Promise<AiSettingsRow | undefined> {
    return database.query.aiSettings.findFirst({
      where: eq(aiSettings.organizationId, orgId),
    });
  },
  async upsert(orgId: string, input: AiSettingsInput): Promise<AiSettingsRow> {
    const existing = await aiSettingsRepo.get(orgId);
    if (existing) {
      await database
        .update(aiSettings)
        .set({
          provider: input.provider,
          defaultModel: input.defaultModel ?? null,
          monthlyBudget: input.monthlyBudget ?? null,
          promptOverrides: input.promptOverrides ?? null,
          updatedAt: nowIso(),
        })
        .where(eq(aiSettings.organizationId, orgId));
    } else {
      await database.insert(aiSettings).values({
        id: uid(),
        organizationId: orgId,
        provider: input.provider,
        defaultModel: input.defaultModel ?? null,
        monthlyBudget: input.monthlyBudget ?? null,
        promptOverrides: input.promptOverrides ?? null,
      });
    }
    return (await aiSettingsRepo.get(orgId))!;
  },
};

// ---------- admin: AI usage ----------

export interface AiUsageSummary {
  totalEvents: number;
  monthEvents: number;
  monthCost: number;
  byFeature: { feature: string; events: number; cost: number }[];
  byUser: { name: string | null; events: number; cost: number }[];
}

const aiUsageRepo = {
  async record(input: {
    orgId: string;
    projectId?: string | null;
    userId?: string | null;
    feature: string;
    model?: string | null;
    inputTokens?: number;
    outputTokens?: number;
    cost?: number;
  }): Promise<void> {
    await database.insert(aiUsage).values({
      id: uid(),
      organizationId: input.orgId,
      projectId: input.projectId ?? null,
      userId: input.userId ?? null,
      feature: input.feature,
      model: input.model ?? null,
      inputTokens: input.inputTokens ?? 0,
      outputTokens: input.outputTokens ?? 0,
      cost: input.cost ?? 0,
    });
  },
  async summary(orgId: string): Promise<AiUsageSummary> {
    const rows = await database
      .select({
        feature: aiUsage.feature,
        cost: aiUsage.cost,
        createdAt: aiUsage.createdAt,
        userId: aiUsage.userId,
        name: profiles.name,
      })
      .from(aiUsage)
      .leftJoin(profiles, eq(aiUsage.userId, profiles.id))
      .where(eq(aiUsage.organizationId, orgId));

    const monthPrefix = nowIso().slice(0, 7); // YYYY-MM (timestamptz read as string)
    const byFeatureMap = new Map<string, { events: number; cost: number }>();
    const byUserMap = new Map<string, { name: string | null; events: number; cost: number }>();
    let monthEvents = 0;
    let monthCost = 0;

    for (const r of rows) {
      const f = byFeatureMap.get(r.feature) ?? { events: 0, cost: 0 };
      f.events += 1;
      f.cost += r.cost ?? 0;
      byFeatureMap.set(r.feature, f);

      const uk = r.userId ?? "—";
      const u = byUserMap.get(uk) ?? { name: r.name, events: 0, cost: 0 };
      u.events += 1;
      u.cost += r.cost ?? 0;
      byUserMap.set(uk, u);

      if ((r.createdAt ?? "").slice(0, 7) === monthPrefix) {
        monthEvents += 1;
        monthCost += r.cost ?? 0;
      }
    }

    return {
      totalEvents: rows.length,
      monthEvents,
      monthCost,
      byFeature: Array.from(byFeatureMap.entries())
        .map(([feature, v]) => ({ feature, ...v }))
        .sort((a, b) => b.events - a.events),
      byUser: Array.from(byUserMap.values()).sort((a, b) => b.events - a.events),
    };
  },
};

// ---------- admin: audit log ----------

export interface AuditEntry {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  actorName: string | null;
  actorRole: string | null;
  metadata: unknown;
  createdAt: string;
}

const auditRepo = {
  async log(input: {
    orgId: string;
    userId?: string | null;
    projectId?: string | null;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: unknown;
  }): Promise<void> {
    try {
      await database.insert(auditLogs).values({
        id: uid(),
        organizationId: input.orgId,
        userId: input.userId ?? null,
        projectId: input.projectId ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: input.metadata ?? null,
      });
    } catch {
      // Audit logging must never break the underlying operation.
    }
  },
  async list(orgId: string, limit = 200): Promise<AuditEntry[]> {
    const rows = await database
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        actorName: profiles.name,
        actorRole: profiles.role,
      })
      .from(auditLogs)
      .leftJoin(profiles, eq(auditLogs.userId, profiles.id))
      .where(eq(auditLogs.organizationId, orgId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
    return rows;
  },
};

export const db = {
  orgs,
  profiles: profilesRepo,
  projects: projectsRepo,
  hearings: hearingsRepo,
  files: filesRepo,
  scope: scopeRepo,
  decks: decksRepo,
  quality: qualityRepo,
  consistency: consistencyRepo,
  review: reviewRepo,
  documents: documentsRepo,
  estimates: estimatesRepo,
  schedules: schedulesRepo,
  screenDesign: screenDesignRepo,
  admin: adminRepo,
  rateCards: rateCardsRepo,
  templates: templatesRepo,
  aiSettings: aiSettingsRepo,
  aiUsage: aiUsageRepo,
  audit: auditRepo,
};
