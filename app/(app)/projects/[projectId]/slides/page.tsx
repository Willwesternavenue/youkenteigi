import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadEditableDeck } from "@/lib/slides/build";
import { DeckEditor } from "@/components/slides/deck-editor";

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
