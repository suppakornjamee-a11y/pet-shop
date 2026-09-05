"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/components/i18n-provider";

export type ConfirmOptions = {
  title: string;
  description?: string;
  /** ข้อความบนปุ่มยืนยัน — ไม่ใส่ = "ยืนยัน" */
  confirmLabel?: string;
  /** danger = ปุ่มยืนยันสีแดง สำหรับงานที่ย้อนกลับไม่ได้ (ลบ/ยกเลิก) */
  tone?: "default" | "danger";
};

const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(async () => true);

/**
 * กล่องยืนยันกลางของทั้งระบบ — ใช้แทน confirm() ของเบราว์เซอร์
 *
 * confirm() ของเบราว์เซอร์ใช้ปุ่ม OK/Cancel ตามภาษาของเครื่อง ปรับข้อความไม่ได้
 * และหน้าตาไม่เข้ากับระบบ กล่องนี้เลยรวมไว้ที่เดียวให้ทุกหน้าเรียกใช้เหมือนกัน
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "ลบรายการนี้?", tone: "danger" }))) return;
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [pending, setPending] = useState<{
    options: ConfirmOptions;
    resolve: (ok: boolean) => void;
  } | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ options, resolve })),
    []
  );

  function close(ok: boolean) {
    pending?.resolve(ok);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={pending !== null} onOpenChange={(open) => !open && close(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending?.options.title}</DialogTitle>
            {pending?.options.description && (
              <DialogDescription>{pending.options.description}</DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => close(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant={pending?.options.tone === "danger" ? "destructive" : "default"}
              onClick={() => close(true)}
            >
              {pending?.options.confirmLabel ?? t.common.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
