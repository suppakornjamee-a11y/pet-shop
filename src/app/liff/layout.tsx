import type { Metadata } from "next";
import { LiffProvider } from "@/components/liff-provider";

// กลุ่มเส้นทางนี้ (/liff/*) เปิดให้ลูกค้าเข้าได้โดยไม่ต้องล็อกอิน — ตั้งใจไม่ import
// requireUser/requireStaffUser ที่นี่หรือในหน้าลูกใดๆ ใต้กลุ่มนี้เด็ดขาด (ดูแผนงาน
// lexical-coalescing-crystal.md ส่วน "หลักความปลอดภัยข้อสำคัญที่สุด")
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "จองบริการผ่าน LINE — PetCare",
};

export default function LiffLayout({ children }: { children: React.ReactNode }) {
  return (
    <LiffProvider>
      <div className="mx-auto min-h-dvh w-full max-w-md bg-background px-4 py-6">{children}</div>
    </LiffProvider>
  );
}
