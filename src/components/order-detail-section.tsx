import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** กล่องย่อยในการ์ดรายละเอียดออเดอร์ — หัวข้อเล็กพร้อมไอคอนเหมือนกันทุกส่วน เนื้อหาอยู่ในกรอบเดียวกัน ให้หน้าดูเป็นสัดส่วน */
export function DetailSection({
  title,
  icon: Icon,
  action,
  className,
  children,
}: {
  title: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border bg-muted/20 p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}
