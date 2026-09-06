"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// สีชุดเดียวกับหน้า login — ตรึงโทนสว่างไว้โทนเดียว ไม่ตามธีมมืดของแอป จึงต้องเขียน dark:
// ทับทุกจุดที่ component พื้นฐานตั้งค่าไว้ ไม่งั้นสีจะเพี้ยนเมื่อผู้ใช้เปิดธีมมืด
const FIELD =
  "h-12 rounded-full border-[#e4d9c9] bg-white pr-4 pl-11 text-sm text-[#2f2a24] " +
  "shadow-[0_1px_2px_rgba(47,42,36,0.05)] placeholder:text-[#a79a8a] " +
  "focus-visible:border-[#ba4775] focus-visible:ring-[#ba4775]/20 " +
  "dark:border-[#e4d9c9] dark:bg-white dark:text-[#2f2a24]";

// ช่องที่กรอกไม่ครบ — ขอบและวงโฟกัสเป็นสีแดงให้เห็นชัดว่าต้องแก้ตรงไหน
const FIELD_ERROR =
  "border-[#d64545] focus-visible:border-[#d64545] focus-visible:ring-[#d64545]/20 " +
  "dark:border-[#d64545]";

const LEADING_ICON = "pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2";

type Errors = { username?: string; password?: string };

export function LoginForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  // เว้นว่างไว้เพื่อให้ placeholder โผล่ (เดิมใส่ admin/admin ไว้ให้ตอนมีบรรทัดบัญชีทดลอง)
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // ตรวจเองแทน required ของเบราว์เซอร์ — required เด้ง tooltip ของระบบซึ่งหน้าตาไม่เข้ากับหน้านี้
    // และใช้ภาษาตามเครื่องผู้ใช้ ปรับข้อความไม่ได้
    const next: Errors = {};
    if (!username.trim()) next.username = t.login.usernameRequired;
    if (!password) next.password = t.login.passwordRequired;
    setErrors(next);
    setFormError("");
    if (next.username || next.password) {
      (next.username ? usernameRef : passwordRef).current?.focus();
      return;
    }

    startTransition(async () => {
      const res = await signIn("credentials", { username, password, redirect: false });
      if (res?.error) {
        // โชว์ในฟอร์มด้วย ไม่ใช่แค่ toast ที่หายไปเอง — ผู้ใช้จะได้เห็นตอนลองพิมพ์ใหม่
        setFormError(t.login.loginFailedDesc);
        passwordRef.current?.focus();
        return;
      }
      toast.success(t.login.loginSuccess);
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3 text-left">
      {formError && (
        <div className="flex items-start gap-2 rounded-2xl border border-[#f0c9c9] bg-[#fdf0f0] px-4 py-2.5 text-sm text-[#a32f2f]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <div>
        <div className="relative">
          <User
            aria-hidden
            className={cn(LEADING_ICON, errors.username ? "text-[#d64545]" : "text-[#a79a8a]")}
          />
          <Input
            id="username"
            ref={usernameRef}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (errors.username) setErrors((p) => ({ ...p, username: undefined }));
            }}
            placeholder={t.login.username}
            autoComplete="username"
            aria-invalid={!!errors.username}
            className={cn(FIELD, errors.username && FIELD_ERROR)}
          />
        </div>
        {errors.username && (
          <p className="mt-1.5 pl-4 text-xs text-[#d64545]">{errors.username}</p>
        )}
      </div>

      <div>
        <div className="relative">
          <Lock
            aria-hidden
            className={cn(LEADING_ICON, errors.password ? "text-[#d64545]" : "text-[#a79a8a]")}
          />
          <Input
            id="password"
            ref={passwordRef}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
            }}
            placeholder={t.login.password}
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            className={cn(FIELD, "pr-12", errors.password && FIELD_ERROR)}
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
        {errors.password && (
          <p className="mt-1.5 pl-4 text-xs text-[#d64545]">{errors.password}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="mt-5 h-12 w-full rounded-full bg-[#ba4775] text-[0.95rem] font-medium text-white shadow-[0_6px_18px_rgba(186,71,117,0.25)] hover:bg-[#99355f]"
      >
        {isPending ? <Loader2 className="animate-spin" /> : null}
        {t.login.submit}
      </Button>
    </form>
  );
}
