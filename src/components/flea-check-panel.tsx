"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { confirmOrderFleaTick, requestOrderFleaTickInfo } from "@/app/actions/flea-tick";
import type { FleaCheckLogLevel } from "@/lib/order-log";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { StyleImagesViewer } from "@/components/style-images-viewer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const TONE: Record<FleaCheckLogLevel, { box: string; pill: string }> = {
  GREEN: {
    box: "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30",
    pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  YELLOW: {
    box: "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30",
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  },
  RED: {
    box: "border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/30",
    pill: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  },
};

/**
 * ผลตรวจข้อมูลยาเห็บหมัดที่ระบบสรุปไว้ตอนลูกค้าจอง (เขียว/เหลือง/แดง) + รูปหลักฐานที่ลูกค้าแนบ
 * พนักงานตรวจตอนเช็คคิวแล้วกด "ยืนยัน" หรือ "ขอข้อมูลเพิ่ม" (ส่งข้อความ LINE ถึงลูกค้า) — ถ้าไม่ผ่านใช้ปุ่ม "ปฏิเสธคิว" ตามปกติ
 */
export function FleaCheckPanel({
  orderId,
  level,
  text,
  evidence,
  checked,
  canAct,
}: {
  orderId: string;
  level: FleaCheckLogLevel;
  text: string;
  evidence: string[];
  checked: boolean;
  canAct: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [askOpen, setAskOpen] = useState(false);
  const [message, setMessage] = useState("");
  const tone = TONE[level];

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      after?.();
      router.refresh();
    });
  }

  return (
    <div className={cn("mt-2 space-y-2 rounded-lg border p-2.5 text-xs", tone.box)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn("rounded-full px-2 py-0.5 font-medium", tone.pill)}>{t.fleaTick.check.level[level]}</span>
        {checked && (
          <span className="rounded-full border px-2 py-0.5 text-muted-foreground">{t.fleaTick.check.checked}</span>
        )}
      </div>
      <p>{text}</p>
      {evidence.length > 0 && (
        <div className="space-y-1">
          <div className="text-muted-foreground">{t.fleaTick.evidenceLabel}</div>
          <StyleImagesViewer images={evidence} title={t.fleaTick.evidenceLabel} />
        </div>
      )}
      {canAct && !checked && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={isPending} onClick={() => run(() => confirmOrderFleaTick(orderId))}>
            {isPending && <Loader2 className="animate-spin" />}
            {t.fleaTick.check.confirm}
          </Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => setAskOpen(true)}>
            {t.fleaTick.check.request}
          </Button>
        </div>
      )}

      <Dialog open={askOpen} onOpenChange={setAskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.fleaTick.check.requestTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="flea-ask-message" className="text-xs">
              {t.fleaTick.check.requestLabel}
            </Label>
            <Textarea
              id="flea-ask-message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAskOpen(false)} disabled={isPending}>
              {t.common.cancel}
            </Button>
            <Button
              disabled={isPending || !message.trim()}
              onClick={() =>
                run(
                  () => requestOrderFleaTickInfo(orderId, message),
                  () => {
                    setAskOpen(false);
                    setMessage("");
                  }
                )
              }
            >
              {isPending && <Loader2 className="animate-spin" />}
              {t.fleaTick.check.requestSend}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
