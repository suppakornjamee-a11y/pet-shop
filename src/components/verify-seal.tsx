import { cn } from "@/lib/utils";

/** เส้นขอบของตรา: วงกลมที่ขอบเป็นคลื่น 8 กลีบ (แบบตราไอคอนยืนยันของ IG/Facebook) คำนวณครั้งเดียวตอนโหลดโมดูล */
const SEAL_PATH = (() => {
  const points: string[] = [];
  const steps = 160;
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const r = 9.7 + 1.1 * Math.cos(8 * theta);
    points.push(`${(12 + r * Math.cos(theta)).toFixed(2)} ${(12 + r * Math.sin(theta)).toFixed(2)}`);
  }
  return `M${points.join("L")}Z`;
})();

/** ตราแบบไอคอนยืนยันของ IG/Facebook — เขียว + เครื่องหมายถูก = ผ่าน · เหลืองอำพัน + นาฬิกา = รอแอดมินตรวจสอบ */
export function VerifySeal({ passed, label, className }: { passed: boolean; label: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={label}
      className={cn("h-6 w-6 shrink-0 drop-shadow-sm", passed ? "text-emerald-500" : "text-amber-500", className)}
    >
      <title>{label}</title>
      <path d={SEAL_PATH} fill="currentColor" />
      {passed ? (
        <path d="M8.3 12.4l2.6 2.6 4.9-5.3" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <>
          <circle cx="12" cy="12" r="4.3" fill="none" stroke="white" strokeWidth="1.8" />
          <path d="M12 9.9V12l1.5 1" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}
