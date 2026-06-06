"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { ROLES, ROLE_LABELS, type Role } from "@/types/domain";
import {
  inviteUser,
  setUserRole,
  setUserDisabled,
} from "@/app/_actions/admin";

export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  disabled: boolean;
  lastLoginAt: string | null;
}

function RoleSelect({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: Role;
  disabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  function onChange(value: string | null) {
    if (!value || value === role) return;
    startTransition(async () => {
      const res = await setUserRole(userId, value as Role);
      if (res?.ok) toast.success("ロールを更新しました");
      else toast.error(res?.error ?? "更新できませんでした");
    });
  }
  return (
    <Select value={role} onValueChange={onChange} disabled={disabled || pending}>
      <SelectTrigger className="w-36" size="sm">
        <SelectValue>
          {(v: string | null) => (v ? ROLE_LABELS[v as Role] : "")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_LABELS[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function InviteDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await inviteUser({ email, name, role });
      if (res.ok) {
        toast.success("招待しました（初回ログインで有効化されます）");
        setOpen(false);
        setEmail("");
        setName("");
        setRole("viewer");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" />
        ユーザーを招待
      </Button>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>ユーザーを招待</DialogTitle>
          <DialogDescription>
            ロールを割り当てて事前登録します。対象者が初回ログインすると、このロールで有効化されます。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">メールアドレス</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="member@aidealab.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">表示名（任意）</Label>
            <Input
              id="invite-name"
              placeholder="山田 太郎"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>ロール</Label>
            <Select
              value={role}
              onValueChange={(v) => v && setRole(v as Role)}
            >
              <SelectTrigger>
                <SelectValue>
                  {(v: string | null) => (v ? ROLE_LABELS[v as Role] : "")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            キャンセル
          </Button>
          <Button onClick={submit} disabled={pending || !email}>
            招待する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleDisabledButton({
  userId,
  disabled,
  isSelf,
}: {
  userId: string;
  disabled: boolean;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  function toggle() {
    startTransition(async () => {
      const res = await setUserDisabled(userId, !disabled);
      if (res.ok)
        toast.success(disabled ? "再有効化しました" : "無効化しました");
      else toast.error(res.error);
    });
  }
  return (
    <Button
      size="sm"
      variant={disabled ? "outline" : "ghost"}
      onClick={toggle}
      disabled={pending || isSelf}
      title={isSelf ? "自分自身は無効化できません" : undefined}
    >
      {disabled ? "再有効化" : "無効化"}
    </Button>
  );
}

export function UsersTable({
  users,
  currentUserId,
}: {
  users: AdminUser[];
  currentUserId: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{users.length} 名</p>
        <InviteDialog />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ユーザー</TableHead>
              <TableHead>ロール</TableHead>
              <TableHead>最終ログイン</TableHead>
              <TableHead>状態</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <TableRow key={u.id} className={u.disabled ? "opacity-60" : ""}>
                  <TableCell>
                    <div className="font-medium">
                      {u.name ?? u.email.split("@")[0]}
                      {isSelf && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (自分)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {u.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <RoleSelect
                      userId={u.id}
                      role={u.role}
                      disabled={isSelf}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.lastLoginAt ? formatDate(u.lastLoginAt) : "未ログイン"}
                  </TableCell>
                  <TableCell>
                    {u.disabled ? (
                      <Badge variant="outline">無効</Badge>
                    ) : u.lastLoginAt ? (
                      <Badge variant="secondary">有効</Badge>
                    ) : (
                      <Badge variant="outline">招待済み</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <ToggleDisabledButton
                      userId={u.id}
                      disabled={u.disabled}
                      isSelf={isSelf}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
