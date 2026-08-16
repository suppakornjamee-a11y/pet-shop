import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-helpers";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/get-dictionary";
import { LoginForm } from "@/components/login-form";
import { LanguageToggle } from "@/components/language-toggle";

// pattern อุ้งเท้าสัตว์ ซ้ำเป็นพื้นหลัง (SVG inline เพื่อไม่ต้องพึ่งไฟล์ภายนอก)
const PAW_PATTERN =
  "PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2NCcgaGVpZ2h0PSc2NCcgdmlld0JveD0nMCAwIDI0IDI0JyBmaWxsPScjZjU5ZTBiJyBmaWxsLW9wYWNpdHk9JzAuMTAnPjxjaXJjbGUgY3g9JzEyJyBjeT0nMTYuNScgcj0nNC4yJy8+PGNpcmNsZSBjeD0nNC41JyBjeT0nMTAnIHI9JzIuMycvPjxjaXJjbGUgY3g9JzE5LjUnIGN5PScxMCcgcj0nMi4zJy8+PGNpcmNsZSBjeD0nOCcgY3k9JzQuNScgcj0nMicvPjxjaXJjbGUgY3g9JzE2JyBjeT0nNC41JyByPScyJy8+PC9zdmc+";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  const t = getDictionary(await getLocale());

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gradient-to-br from-[#fdf1de] to-[#fbe4c0] p-4 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml;base64,${PAW_PATTERN}")`,
          backgroundSize: "64px 64px",
        }}
      />

      <div className="absolute top-4 right-4 z-10">
        <LanguageToggle />
      </div>

      <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-3xl bg-card shadow-2xl md:min-h-[560px] md:grid-cols-2">
        {/* Photo panel — public/images/login-hero.png (รูปเดี่ยว) */}
        <div className="relative hidden overflow-hidden md:block">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-200 via-orange-200 to-rose-200" />
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url(/images/login-hero.png)" }}
          />
        </div>

        {/* Form panel */}
        <div className="flex flex-col justify-center p-8 sm:p-12">
          <h1 className="mb-8 bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
            Pawsome Space
          </h1>

          <div>
            <LoginForm />
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {t.login.demoAccountsLabel}: <span className="font-medium text-foreground">admin / admin</span> ·{" "}
            <span className="font-medium text-foreground">user / user</span>
          </p>
        </div>
      </div>
    </main>
  );
}
