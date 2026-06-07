import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  ScreenListView,
  type ScreenItem,
} from "@/components/design/screen-list-view";

// AI生成は最長~120秒。Server Actionのタイムアウト既定値をページ単位で
// 引き上げる（Vercel Pro: 最大300秒）。
export const maxDuration = 300;


export default async function ScreensPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  const sd = await db.screenDesign.getLatest(user.orgId, projectId);

  const screens: ScreenItem[] = (sd?.screens ?? []).map((s) => ({
    key: s.screenKey,
    name: s.screenName,
    role: s.userRole ?? undefined,
    purpose: s.purpose ?? "",
    uiElements: s.uiElements ?? [],
    states: s.states ?? undefined,
    priority: s.priority ?? undefined,
  }));

  return (
    <ScreenListView
      projectId={projectId}
      hasDesign={!!sd}
      version={sd?.design.version ?? 0}
      screens={screens}
    />
  );
}
