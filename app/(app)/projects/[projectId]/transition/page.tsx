import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  TransitionView,
  type TransitionScreen,
  type TransitionEdge,
} from "@/components/design/transition-view";
import type { WireframeBlock } from "@/lib/ai/providers";

export default async function TransitionPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const sd = await db.screenDesign.getLatest(user.orgId, projectId);

  if (!sd) {
    return (
      <TransitionView
        projectId={projectId}
        hasDesign={false}
        version={0}
        screens={[]}
        transitions={[]}
      />
    );
  }

  const idToKey = new Map(sd.screens.map((s) => [s.id, s.screenKey]));
  const transitions: TransitionEdge[] = sd.transitions
    .map((t) => ({
      from: idToKey.get(t.fromScreenId ?? "") ?? "",
      to: idToKey.get(t.toScreenId ?? "") ?? "",
      label: t.triggerAction ?? undefined,
    }))
    .filter((t) => t.from && t.to);

  const screens: TransitionScreen[] = sd.screens.map((s) => ({
    key: s.screenKey,
    name: s.screenName,
    role: s.userRole ?? undefined,
    wireframe: (s.wireframe ?? []) as WireframeBlock[],
  }));

  return (
    <TransitionView
      projectId={projectId}
      hasDesign
      version={sd.design.version}
      screens={screens}
      transitions={transitions}
    />
  );
}
