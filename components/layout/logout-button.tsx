"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/_actions/auth";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button variant="ghost" size="sm" type="submit" className="gap-2">
        <LogOut className="size-4" />
        <span className="hidden sm:inline">ログアウト</span>
      </Button>
    </form>
  );
}
