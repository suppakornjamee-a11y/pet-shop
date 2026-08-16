import { PageHeader } from "@/components/page-header";
import { RegisterForm } from "@/components/register-form";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

export default async function RegisterPage() {
  const t = getDictionary(await getLocale());
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t.register.pageTitle}
        description={t.register.pageDescription}
      />
      <RegisterForm />
    </div>
  );
}
