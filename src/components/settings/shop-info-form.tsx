"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { upsertShopInfo } from "@/app/actions/settings";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

type ShopInfo = { name: string; address: string; taxId: string; lineId: string };

export function ShopInfoForm({ shopInfo }: { shopInfo: ShopInfo }) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState(shopInfo);

  function save() {
    startTransition(async () => {
      const res = await upsertShopInfo(form);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  return (
    <Card className="max-w-lg">
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>{t.settings.shopInfo.nameLabel}</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>{t.settings.shopInfo.addressLabel}</Label>
          <Textarea
            rows={3}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t.settings.shopInfo.taxIdLabel}</Label>
          <Input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>{t.settings.shopInfo.lineIdLabel}</Label>
          <Input
            value={form.lineId}
            onChange={(e) => setForm({ ...form, lineId: e.target.value })}
            placeholder="@pawsomespacebkk"
          />
        </div>
        <Button onClick={save} disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : <Save />}
          {t.settings.shopInfo.saveButton}
        </Button>
      </CardContent>
    </Card>
  );
}
