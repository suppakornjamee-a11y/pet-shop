import { redirect } from "next/navigation";
import { CalendarClock, QrCode, PawPrint, ShieldCheck } from "lucide-react";
import { getSessionUser } from "@/lib/auth-helpers";
import { LoginForm } from "@/components/login-form";

const features = [
  { icon: CalendarClock, text: "จองคิว + ปฏิทินร้าน กันคิวชนกันอัตโนมัติ" },
  { icon: QrCode, text: "รับชำระเงินด้วย QR PromptPay ไม่มีค่าธรรมเนียม" },
  { icon: PawPrint, text: "ประวัติลูกค้า สัตว์เลี้ยง และคลังสินค้าในที่เดียว" },
  { icon: ShieldCheck, text: "แยกสิทธิ์แอดมิน / พนักงาน ปลอดภัย" },
];

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-primary p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 text-[22rem] leading-none opacity-10 select-none"
        >
          🐾
        </div>
        <div className="relative flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur">
            🐾
          </span>
          <span className="text-2xl font-extrabold tracking-tight">PetCare</span>
        </div>
        <div className="relative">
          <h2 className="max-w-md text-3xl font-extrabold leading-snug tracking-tight text-balance">
            ระบบจัดการร้านอาบน้ำ ตัดขน และฝากเลี้ยงสัตว์
          </h2>
          <ul className="mt-8 space-y-4">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.text} className="flex items-center gap-3 text-white/90">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[0.95rem]">{f.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="relative text-sm text-white/60">© PetCare · ระบบจัดการร้านสัตว์เลี้ยง</div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-3xl">
              🐾
            </div>
            <h1 className="text-xl font-extrabold tracking-tight">PetCare</h1>
          </div>
          <div className="mb-6 hidden lg:block">
            <h1 className="text-2xl font-extrabold tracking-tight">ยินดีต้อนรับกลับ 👋</h1>
            <p className="mt-1 text-sm text-muted-foreground">เข้าสู่ระบบเพื่อจัดการร้านของคุณ</p>
          </div>
          <LoginForm />
          <p className="mt-6 text-center text-xs text-muted-foreground">
            บัญชีทดลอง: <span className="font-medium text-foreground">admin / admin</span> ·{" "}
            <span className="font-medium text-foreground">user / user</span>
          </p>
        </div>
      </div>
    </main>
  );
}
