"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, ShieldCheck, User as UserIcon } from "lucide-react";
import { createUser, updateUser, deleteUser } from "@/app/actions/settings";
import type { Role } from "@/generated/prisma/enums";
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
};

export function UserManager({
  users,
  currentUserId,
}: {
  users: User[];
  currentUserId: string;
}) {
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
  });

  function openNew() {
    setEditing(null);
    setForm({ username: "", name: "", email: "", password: "", role: "USER", active: true });
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
          })
        : await createUser({
            username: form.username,
            name: form.name,
            email: form.email || undefined,
            password: form.password,
            role: form.role,
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
    if (!confirm("ลบผู้ใช้งานนี้?")) return;
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
          <Plus /> เพิ่มผู้ใช้งาน
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
                    ) : (
                      <UserIcon className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      {u.name}
                      {!u.active && (
                        <Badge variant="secondary" className="text-[10px]">
                          ปิดใช้งาน
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      @{u.username} · {u.role === "ADMIN" ? "แอดมิน" : "พนักงาน"}
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
            <DialogTitle>{editing ? "แก้ไขผู้ใช้งาน" : "เพิ่มผู้ใช้งาน"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>ชื่อผู้ใช้ (username) *</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                disabled={!!editing}
              />
            </div>
            <div className="space-y-2">
              <Label>ชื่อ-นามสกุล *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>อีเมล</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>สิทธิ์การใช้งาน</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as Role })}
                items={{ ADMIN: "แอดมิน", USER: "พนักงาน" }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">แอดมิน</SelectItem>
                  <SelectItem value="USER">พนักงาน</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>
                {editing ? "รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)" : "รหัสผ่าน *"}
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
                เปิดใช้งานบัญชีนี้
              </label>
            )}
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={isPending || !form.name}>
              {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
