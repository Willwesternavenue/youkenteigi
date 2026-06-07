import "server-only";
import { db } from "@/lib/db";

/**
 * Past-project retrieval (RAG) — keyword/lexical similarity over the org's
 * previous projects, injected into generation context so output is grounded in
 * prior work. Pure Postgres data + in-process scoring (no extra API key /
 * extension). Designed behind this function so it can be swapped for pgvector
 * embeddings later without touching callers.
 */
export interface PastProjectRef {
  projectName: string;
  industry?: string;
  summary: string;
}

// Latin words + CJK character bigrams → rough lexical tokens (Japanese has no
// word boundaries, so bigrams approximate term overlap).
function tokenize(s: string): string[] {
  const lower = (s ?? "").toLowerCase();
  const latin = lower.match(/[a-z0-9]{2,}/g) ?? [];
  const cjk = lower.match(/[ぁ-んァ-ヶー一-龠]/g) ?? [];
  const bigrams: string[] = [];
  for (let i = 0; i < cjk.length - 1; i++) bigrams.push(cjk[i] + cjk[i + 1]);
  return [...latin, ...bigrams];
}

export async function findSimilarProjects(
  orgId: string,
  currentProjectId: string,
  signalText: string,
  industry: string | null,
  limit = 3,
): Promise<PastProjectRef[]> {
  const all = await db.projects.list(orgId);
  const q = new Set(tokenize(`${signalText} ${industry ?? ""}`));
  if (q.size === 0) return [];

  const scored = all
    .filter((p) => p.id !== currentProjectId)
    .map((p) => {
      const text = [p.projectName, p.industry, p.description, p.note]
        .filter(Boolean)
        .join(" ");
      let score = 0;
      for (const t of tokenize(text)) if (q.has(t)) score++;
      if (industry && p.industry && p.industry === industry) score += 5; // same-industry boost
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ p }) => ({
    projectName: p.projectName,
    industry: p.industry ?? undefined,
    summary: [
      p.industry ? `業界: ${p.industry}` : null,
      p.recommendedPhase ? `フェーズ: ${p.recommendedPhase}` : null,
      p.developmentForm ? `契約: ${p.developmentForm}` : null,
      p.budgetMin || p.budgetMax
        ? `予算: ${p.budgetMin ?? "-"}〜${p.budgetMax ?? "-"}円`
        : null,
      p.description ? `概要: ${p.description.slice(0, 160)}` : null,
    ]
      .filter(Boolean)
      .join(" / "),
  }));
}
