"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, ImagePlus, Loader2, Save, X } from "lucide-react";
import { updateMyProfile } from "@/app/actions/profile";
import { fileToDataUrl } from "@/lib/file";
import { useI18n } from "@/components/i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type MyProfile = {
  name: string;
  email: string;
  avatarUrl: string | null;
};

/** แก้ไขโปรไฟล์ตัวเอง — เปิดจากปุ่มโปรไฟล์มุมขวาบน */
export function ProfileDialog({
  profile,
  open,
  onOpenChange,
}: {
  profile: MyProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: profile.name,
    email: profile.email,
    avatarUrl: profile.avatarUrl ?? "",
    password: "",
  });

  async function handleImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setImageError("");
    try {
      // จำกัด 1MB เพราะเก็บเป็น data URL ลงฐานข้อมูลโดยตรง (แนวเดียวกับรูปสินค้า/สัตว์เลี้ยง)
      const dataUrl = await fileToDataUrl(file, 1024 * 1024);
      setForm((prev) => ({ ...prev, avatarUrl: dataUrl }));
    } catch (e) {
      setImageError(e instanceof Error ? e.message : t.profile.uploadFailed);
    } finally {
      setUploading(false);
    }
  }

  function save() {
    startTransition(async () => {
      const res = await updateMyProfile({
        name: form.name,
        email: form.email,
        avatarUrl: form.avatarUrl || null,
        password: form.password || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setForm((prev) => ({ ...prev, password: "" }));
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.profile.title}</DialogTitle>
        </DialogHeader>

        {/* แถบรูปโปรไฟล์ — แยกเป็นส่วนของตัวเองแบบเดียวกับแถบปุ่มบันทึกด้านล่าง */}
        <div className="-mx-4 flex items-center gap-4 border-y bg-muted/50 px-4 py-4">
          <div className="relative">
            <Avatar className="h-20 w-20">
              {form.avatarUrl && <AvatarImage src={form.avatarUrl} alt="" />}
              <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
                {form.name.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {form.avatarUrl && (
              <button
                type="button"
                onClick={() => setForm({ ...form, avatarUrl: "" })}
                aria-label={t.common.delete}
                className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-1">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent/50">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              {t.profile.uploadPhoto}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => handleImage(e.target.files?.[0])}
              />
            </label>
            {imageError && <p className="text-xs text-destructive">{imageError}</p>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>{t.profile.nameLabel}</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t.profile.emailLabel}</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          {/* ช่องรหัสผ่านช่องเดียว — ปล่อยว่างไว้ = ไม่เปลี่ยน พิมพ์ทับ = ตั้งรหัสใหม่
              placeholder เป็น xxxxxx สื่อว่ามีรหัสผ่านตั้งไว้อยู่แล้ว (ดึงรหัสเดิมมาโชว์ไม่ได้ ระบบเก็บแบบเข้ารหัส) */}
          <div className="space-y-2 sm:col-span-2">
            <Label>{t.profile.passwordLabel}</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="xxxxxx"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t.login.hidePassword : t.login.showPassword}
                className="absolute top-1/2 right-1.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={isPending || !form.name}>
            {isPending ? <Loader2 className="animate-spin" /> : <Save />}
            {t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
