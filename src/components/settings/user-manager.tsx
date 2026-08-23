"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, ShieldCheck, User as UserIcon, Scissors } from "lucide-react";
import { createUser, updateUser, deleteUser } from "@/app/actions/settings";
import type { Role, GroomerLevel } from "@/generated/prisma/enums";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type User = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: Role;
  active: boolean;
  groomerLevel: GroomerLevel | null;
};

export function UserManager({
  users,
  currentUserId,
}: {
  users: User[];
  currentUserId: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({
    username: "",
    name: "",
    email: "",
    password: "",
    role: "USER" as Role,
    active: true,
    groomerLevel: "JUNIOR" as GroomerLevel,
  });

  function openNew() {
    setEditing(null);
    setForm({ username: "", name: "", email: "", password: "", role: "USER", active: true, groomerLevel: "JUNIOR" });
    setOpen(true);
  }
  function openEdit(u: User) {
    setEditing(u);
    setForm({
      username: u.username,
      name: u.name,
      email: u.email ?? "",
      password: "",
      role: u.role,
      active: u.active,
      groomerLevel: u.groomerLevel ?? "JUNIOR",
    });
    setOpen(true);
  }

  function save() {
    startTransition(async () => {
      const res = editing
        ? await updateUser({
            id: editing.id,
            name: form.name,
            email: form.email || undefined,
            role: form.role,
            active: form.active,
            password: form.password || undefined,
            groomerLevel: form.role === "GROOMER" ? form.groomerLevel : undefined,
          })
        : await createUser({
            username: form.username,
            name: form.name,
            email: form.email || undefined,
            password: form.password,
            role: form.role,
            groomerLevel: form.role === "GROOMER" ? form.groomerLevel : undefined,
          });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setOpen(false);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm(t.settings.users.confirmDelete)) return;
    startTransition(async () => {
      const res = await deleteUser(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus /> {t.settings.users.addUser}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {u.role === "ADMIN" ? (
                      <ShieldCheck className="h-5 w-5" />
                    ) : u.role === "GROOMER" ? (
                      <Scissors className="h-5 w-5" />
                    ) : (
                      <UserIcon className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      {u.name}
                      {!u.active && (
                        <Badge variant="secondary" className="text-[10px]">
                          {t.settings.users.inactiveBadge}
                        </Badge>
                      )}
                      {u.role === "GROOMER" && u.groomerLevel && (
                        <Badge variant="outline" className="text-[10px]">
                          {u.groomerLevel === "SENIOR"
                            ? t.settings.users.groomerLevelSenior
                            : t.settings.users.groomerLevelJunior}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      @{u.username} ·{" "}
                      {u.role === "ADMIN"
                        ? t.settings.users.roleAdmin
                        : u.role === "GROOMER"
                          ? t.settings.users.roleGroomer
                          : t.settings.users.roleStaff}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(u)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {u.id !== currentUserId && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => remove(u.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t.settings.users.editUser : t.settings.users.addUser}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.settings.users.usernameFullLabel}</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                disabled={!!editing}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.settings.users.nameFullLabel}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t.settings.users.emailLabel}</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.settings.users.roleLabel}</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as Role })}
                items={{
                  ADMIN: t.settings.users.roleAdmin,
                  USER: t.settings.users.roleStaff,
                  GROOMER: t.settings.users.roleGroomer,
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">{t.settings.users.roleAdmin}</SelectItem>
                  <SelectItem value="USER">{t.settings.users.roleStaff}</SelectItem>
                  <SelectItem value="GROOMER">{t.settings.users.roleGroomer}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === "GROOMER" && (
              <div className="space-y-2">
                <Label>{t.settings.users.groomerLevelLabel}</Label>
                <Select
                  value={form.groomerLevel}
                  onValueChange={(v) => setForm({ ...form, groomerLevel: v as GroomerLevel })}
                  items={{
                    JUNIOR: t.settings.users.groomerLevelJunior,
                    SENIOR: t.settings.users.groomerLevelSenior,
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="JUNIOR">{t.settings.users.groomerLevelJunior}</SelectItem>
                    <SelectItem value="SENIOR">{t.settings.users.groomerLevelSenior}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label>
                {editing ? t.settings.users.passwordEditLabel : t.settings.users.passwordFullLabel}
              </Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            {editing && (
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                {t.settings.users.activeAccountCheckbox}
              </label>
            )}
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={isPending || !form.name}>
              {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
