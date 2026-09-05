import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/components/i18n-provider";
import { ConfirmProvider } from "@/components/confirm-provider";
import { getLocale } from "@/i18n/get-locale";

const fontSans = Prompt({
  variable: "--font-sans",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "PetCare — ระบบจัดการร้านอาบน้ำ/ฝากเลี้ยงสัตว์",
  description: "ระบบจัดการร้านอาบน้ำ ตัดขน ฝากเลี้ยงสัตว์เลี้ยง และคลังสินค้า",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${fontSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-muted/40 font-sans">
        <ThemeProvider>
          <I18nProvider locale={locale}>
            <ConfirmProvider>
              {children}
              <Toaster richColors position="top-center" />
            </ConfirmProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
