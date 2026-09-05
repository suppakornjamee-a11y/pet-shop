"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Send } from "lucide-react";
import { emailReceipt } from "@/app/actions/receipt";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** ส่งใบเสร็จเข้าอีเมล — เติมอีเมลลูกค้าให้อัตโนมัติถ้ามีในระบบ
 *  บิลร้านอาหารเป็น walk-in ไม่มีอีเมล พนักงานพิมพ์เองได้ */
export function ReceiptEmailButton({
  orderId,
  defaultEmail,
}: {
  orderId: string;
  defaultEmail: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [isPending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const res = await emailReceipt({ orderId, email });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // โหมดทดลอง: เปิดหน้าพรีวิวอีเมลให้ดูทันที (อีเมลไม่ได้ถูกส่งออกไปจริง)
      if (res.previewUrl) {
        toast.success(res.message, {
          action: { label: t.print.viewPreview, onClick: () => window.open(res.previewUrl, "_blank") },
          duration: 15000,
        });
        window.open(res.previewUrl, "_blank");
      } else {
        toast.success(res.message);
      }
      setOpen(false);
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Mail /> {t.print.emailReceipt}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.print.emailReceipt}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="receipt-email">{t.print.emailLabel}</Label>
            <Input
              id="receipt-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && email) send();
              }}
            />
          </div>
          <DialogFooter>
            <Button onClick={send} disabled={isPending || !email}>
              {isPending ? <Loader2 className="animate-spin" /> : <Send />}
              {t.print.sendEmail}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
