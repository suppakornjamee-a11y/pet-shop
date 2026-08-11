import { PageHeader } from "@/components/page-header";
import { RegisterForm } from "@/components/register-form";

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="ลงทะเบียนสัตว์เลี้ยง"
        description="กรอกข้อมูลเจ้าของและสัตว์เลี้ยง สำหรับลูกค้าที่ยังไม่มีประวัติ"
      />
      <RegisterForm />
    </div>
  );
}
