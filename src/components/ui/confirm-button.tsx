"use client";

import { Button } from "@/components/ui/button";
import { useConfirm, type ConfirmOptions } from "@/components/confirm-provider";

/**
 * ปุ่มที่ต้องกดยืนยันก่อนทำงานจริง — ใช้กล่องยืนยันกลางตัวเดียวกับ useConfirm()
 * เหมาะกับปุ่มการกระทำที่เห็นชัดๆ (ยกเลิกออเดอร์ / ปิดงาน / ยืนยันสลิป)
 */
export function ConfirmButton({
  title,
  description,
  confirmLabel,
  tone = "default",
  onConfirm,
  children,
  ...buttonProps
}: ConfirmOptions & {
  onConfirm: () => void;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Button>, "onClick" | "children" | "title">) {
  const confirm = useConfirm();

  return (
    <Button
      {...buttonProps}
      onClick={async () => {
        if (await confirm({ title, description, confirmLabel, tone })) onConfirm();
      }}
    >
      {children}
    </Button>
  );
}
