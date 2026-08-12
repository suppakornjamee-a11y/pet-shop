import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const fontSans = Noto_Sans_Thai({
  variable: "--font-sans",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "PetCare — ระบบจัดการร้านอาบน้ำ/ฝากเลี้ยงสัตว์",
  description: "ระบบจัดการร้านอาบน้ำ ตัดขน ฝากเลี้ยงสัตว์เลี้ยง และคลังสินค้า",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${fontSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gradient-to-br from-background via-background to-primary/[0.05] font-sans">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
