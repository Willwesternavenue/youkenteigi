import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadEditableDeck } from "@/lib/slides/build";
import { DeckEditor } from "@/components/slides/deck-editor";

// AI生成は最長~120秒。Server Actionのタイムアウト既定値をページ単位で
// 引き上げる（Vercel Pro: 最大300秒）。
export const maxDuration = 300;


export default async function SlidesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const deck = await loadEditableDeck(user.orgId, projectId);
  if (!deck) notFound();

  return (
    <DeckEditor
      projectId={projectId}
      slides={deck.slides}
      hasRequirements={deck.hasRequirements}
      source={deck.source}
    />
  );
}
