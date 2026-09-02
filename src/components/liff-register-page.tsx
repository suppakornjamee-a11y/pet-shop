"use client";

// import Link from "next/link"; -- ใช้ตอนเปิดลิงก์ "เคยเป็นลูกค้าอยู่แล้ว" กลับมาใช้อีกครั้ง
import { useRouter } from "next/navigation";
import { liffRegisterCustomer } from "@/app/actions/liff";
import { useLiff, LiffGate, handleLiffAuthExpiry } from "@/components/liff-provider";
import { useI18n } from "@/components/i18n-provider";
import { PageHeader } from "@/components/page-header";
import { RegisterForm } from "@/components/register-form";

function RegisterBody() {
  const { t } = useI18n();
  const router = useRouter();
  const { idToken } = useLiff();

  return (
    <div>
      <PageHeader title={t.liff.registerPageTitle} description={t.liff.registerPageDescription} />
      {/* คอมเม้นปิดไว้ก่อนตามคำขอ — เปิดกลับมาใช้ได้ทีหลังถ้าต้องการ
      <Link href="/liff/link" className="mb-4 block text-sm text-primary underline underline-offset-2">
        {t.liff.alreadyCustomerLinkText}
      </Link>
      */}
      <RegisterForm
        onSubmit={async ({ customer, pets }) => {
          if (!idToken) return { ok: false as const, error: t.liff.errorTitle };
          const res = await liffRegisterCustomer(idToken, { customer, pets });
          if (!res.ok) handleLiffAuthExpiry(res);
          return res;
        }}
        onSuccess={() => router.push("/liff/book")}
      />
    </div>
  );
}

export function LiffRegisterPage() {
  return (
    <LiffGate>
      <RegisterBody />
    </LiffGate>
  );
}
