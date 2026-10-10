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
      {/*
        BookingTicket.tsx อ้างฟอนต์ด้วยชื่อ "Prompt" ตรงๆ (font-['Prompt']) ซึ่ง next/font ของทั้งแอป
        ไม่ได้ให้ชื่อนี้ตรงๆ (ผูกไว้กับ --font-sans แทน) โหลดจาก Google Fonts ตรงเพิ่มเฉพาะฝั่งลูกค้า
        เพื่อให้ชื่อ "Prompt" resolve ได้จริงโดยไม่ต้องแก้ className ใน component
      */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- ตั้งใจใส่ใน layout นี้ ไม่ใช่ page เดี่ยว ใช้ได้ทุกหน้าในกลุ่ม /liff อยู่แล้ว */}
      <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700&display=swap" rel="stylesheet" />
      {/* liff-theme ตรึงชุดสีชมพูไว้ (ดู globals.css) — ฝั่งลูกค้าไม่สลับตามธีมมืดของฝั่งพนักงาน */}
      <div className="liff-theme mx-auto min-h-dvh w-full max-w-md bg-background px-4 py-6 text-foreground sm:max-w-xl sm:px-6 sm:py-8 md:max-w-2xl lg:max-w-3xl">
        {children}
      </div>
    </LiffProvider>
  );
}
