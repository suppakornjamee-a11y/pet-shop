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
  /** หัวข้อ — ไม่ใส่ = กล่องมีแต่ปุ่ม (หัวข้อยังถูกอ่านโดย screen reader อยู่ ผ่าน srTitle) */
  title?: string;
  description?: string;
  /** ข้อความบนปุ่มยืนยัน — ไม่ใส่ = "ยืนยัน" */
  confirmLabel?: string;
  /** ข้อความบนปุ่มปิดกล่อง — ไม่ใส่ = "ยกเลิก" (ใส่ "ไม่" เมื่อหัวข้อเป็นคำถามใช่/ไม่ หรือเมื่อคำว่ายกเลิกจะซ้ำกับปุ่มยืนยัน) */
  cancelLabel?: string;
  /** danger = ปุ่มยืนยันสีแดง สำหรับงานที่ย้อนกลับไม่ได้ (ลบ/ยกเลิก) */
  tone?: "default" | "danger";
  /** ใช้คู่กับการไม่ใส่ title — ข้อความที่ screen reader อ่านแทน (dialog ต้องมีชื่อเสมอ) */
  srTitle?: string;
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
          {/* ไม่ส่ง title มา = อยากได้กล่องที่มีแต่ปุ่ม แต่ dialog ต้องมีชื่อให้ screen reader เสมอ
              จึงยังเรนเดอร์ DialogTitle ไว้แบบซ่อนสายตา ไม่ใช่ตัดทิ้งทั้งอัน */}
          {pending?.options.title ? (
            <DialogHeader>
              <DialogTitle>{pending.options.title}</DialogTitle>
              {pending.options.description && (
                <DialogDescription>{pending.options.description}</DialogDescription>
              )}
            </DialogHeader>
          ) : (
            <DialogTitle className="sr-only">
              {pending?.options.srTitle ?? pending?.options.confirmLabel ?? t.common.confirm}
            </DialogTitle>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => close(false)}>
              {pending?.options.cancelLabel ?? t.common.cancel}
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
