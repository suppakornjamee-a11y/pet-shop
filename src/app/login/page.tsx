import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-helpers";
import { LoginForm } from "@/components/login-form";
import { LanguageToggle } from "@/components/language-toggle";

// หน้านี้ตั้งใจตรึงเป็นโทนสว่างโทนเดียว (ครีมอุ่นให้เข้ากับสีไม้ในรูปล็อบบี้) ไม่ตามธีมมืดของแอป
// จึงระบุสีตรงๆ ทุกจุด เพื่อกันไม่ให้ token ของธีมมืดเล็ดลอดเข้ามาทำสีเพี้ยน
const CREAM = "#f7f1e8"; // พื้นแผงฟอร์ม
const INK = "#2f2a24"; // ตัวอักษรหลัก
const TAUPE = "#8c8177"; // ตัวอักษรรอง
const LINE = "#e4d9c9"; // เส้นคั่น

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <main className="flex min-h-dvh flex-col lg:flex-row" style={{ background: CREAM, color: INK }}>
      {/* รูปล็อบบี้ — มือถือเป็นแบนเนอร์ด้านบน จอใหญ่กินซ้ายเต็มความสูง
          ไม่วางเลเยอร์ไล่เฉดทับ เพราะทำให้รูปดูจางและมัว */}
      <div
        className="h-56 shrink-0 bg-cover bg-center sm:h-72 lg:h-auto lg:w-[56%]"
        style={{ backgroundImage: "url(/images/login-hero.webp)" }}
      />

      {/* แผงฟอร์ม */}
      <div className="relative flex flex-1 items-center justify-center px-6 py-12 sm:px-10 lg:px-14">
        <div className="absolute top-5 right-5">
          <LanguageToggle />
        </div>

        <div className="w-full max-w-[340px] text-center">
          <h1
            className="text-[2.35rem] leading-[1.08] font-semibold tracking-tight"
            style={{ color: INK }}
          >
            Pawsome Space
          </h1>
          <p
            className="mt-2.5 text-[11px] font-medium tracking-[0.24em] uppercase"
            style={{ color: TAUPE }}
          >
            Hotel &amp; Care
          </p>

          <div aria-hidden className="my-8 h-px" style={{ background: LINE }} />

          <LoginForm />
        </div>
      </div>
    </main>
  );
}
