"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { liffGetProfile, liffUpdateProfile } from "@/app/actions/liff";
import { useLiff, LiffGate, handleLiffAuthExpiry } from "@/components/liff-provider";
import { useI18n } from "@/components/i18n-provider";
import { PageHeader } from "@/components/page-header";
import { RegisterForm } from "@/components/register-form";

type ProfileResult = Extract<Awaited<ReturnType<typeof liffGetProfile>>, { ok: true }>;

function ProfileBody() {
  const { t } = useI18n();
  const { idToken } = useLiff();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileResult | null>(null);

  useEffect(() => {
    if (!idToken) return;
    let active = true;
    (async () => {
      const res = await liffGetProfile(idToken);
      if (!active) return;
      if (!res.ok) {
        handleLiffAuthExpiry(res);
        // ยังไม่เคยลงทะเบียนเลย — ไม่มีโปรไฟล์ให้แก้ พาไปหน้าลงทะเบียนต่อเลยแทนที่จะค้าง error
        if ("notRegistered" in res && res.notRegistered) {
          router.replace("/liff/register");
          return;
        }
        setError(res.error);
        setLoading(false);
        return;
      }
      setProfile(res);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [idToken, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t.liff.loadingTitle}</p>
      </div>
    );
  }
  if (error || !profile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 p-6 text-center">
        <XCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t.liff.profilePageTitle} description={t.liff.profilePageDescription} />
      <RegisterForm
        mode="edit"
        customerId={profile.customerId}
        initialCustomer={profile.customer}
        initialPets={profile.pets}
        onSubmit={async ({ customer, pets }) => {
          if (!idToken) return { ok: false as const, error: t.liff.errorTitle };
          const res = await liffUpdateProfile(idToken, { customer, pets });
          if (!res.ok) handleLiffAuthExpiry(res);
          return res;
        }}
        onSuccess={() => router.push("/liff/book")}
      />
    </div>
  );
}

export function LiffProfilePage() {
  return (
    <LiffGate>
      <ProfileBody />
    </LiffGate>
  );
}
