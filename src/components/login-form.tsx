"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// สีชุดเดียวกับหน้า login — ตรึงโทนสว่างไว้โทนเดียว ไม่ตามธีมมืดของแอป จึงต้องเขียน dark:
// ทับทุกจุดที่ component พื้นฐานตั้งค่าไว้ ไม่งั้นสีจะเพี้ยนเมื่อผู้ใช้เปิดธีมมืด
const FIELD =
  "h-12 rounded-full border-[#e4d9c9] bg-white pr-4 pl-11 text-sm text-[#2f2a24] " +
  "shadow-[0_1px_2px_rgba(47,42,36,0.05)] placeholder:text-[#a79a8a] " +
  "focus-visible:border-[#0f6e72] focus-visible:ring-[#0f6e72]/20 " +
  "dark:border-[#e4d9c9] dark:bg-white dark:text-[#2f2a24]";

const LEADING_ICON =
  "pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[#a79a8a]";

export function LoginForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  // เว้นว่างไว้เพื่อให้ placeholder โผล่ (เดิมใส่ admin/admin ไว้ให้ตอนมีบรรทัดบัญชีทดลอง)
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });
      if (res?.error) {
        toast.error(t.login.loginFailedTitle, {
          description: t.login.loginFailedDesc,
        });
        return;
      }
      toast.success(t.login.loginSuccess);
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-left">
      <div className="relative">
        <User aria-hidden className={LEADING_ICON} />
        <Input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t.login.username}
          autoComplete="username"
          required
          className={FIELD}
        />
      </div>

      <div className="relative">
        <Lock aria-hidden className={LEADING_ICON} />
        <Input
          id="password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t.login.password}
          autoComplete="current-password"
          required
          className={`${FIELD} pr-12`}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? t.login.hidePassword : t.login.showPassword}
          className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#a79a8a] transition-colors hover:bg-[#f7f1e8] hover:text-[#2f2a24]"
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="mt-5 h-12 w-full rounded-full bg-[#0f6e72] text-[0.95rem] font-medium text-white shadow-[0_6px_18px_rgba(15,110,114,0.25)] hover:bg-[#0b5457]"
      >
        {isPending ? <Loader2 className="animate-spin" /> : null}
        {t.login.submit}
      </Button>
    </form>
  );
}
