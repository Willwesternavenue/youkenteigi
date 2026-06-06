import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "./logout-button";
import { ROLE_LABELS, type Role } from "@/types/domain";
import { providerName } from "@/lib/ai/providers";
import { Bot } from "lucide-react";

export function AppHeader({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: Role;
}) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Bot className="size-3.5" />
        <span>AI: {providerName()}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right leading-tight">
          <div className="text-sm font-medium">{name}</div>
          <div className="text-[11px] text-muted-foreground">{email}</div>
        </div>
        <Badge variant="secondary">{ROLE_LABELS[role]}</Badge>
        <LogoutButton />
      </div>
    </header>
  );
}
