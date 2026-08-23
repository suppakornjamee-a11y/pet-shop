"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { addOrderItem } from "@/app/actions/orders";
import { formatBaht } from "@/lib/format";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ServiceOption = { id: string; name: string; price: number };

export function AddOrderItemForm({
  orderId,
  services,
}: {
  orderId: string;
  services: ServiceOption[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serviceId, setServiceId] = useState("");

  function add() {
    if (!serviceId) return;
    startTransition(async () => {
      const res = await addOrderItem(orderId, serviceId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setServiceId("");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={serviceId}
        onValueChange={(v) => setServiceId(v ?? "")}
        items={Object.fromEntries(services.map((s) => [s.id, `${s.name} · ${formatBaht(s.price)}`]))}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t.orders.addItem.selectPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {services.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name} · {formatBaht(s.price)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {serviceId && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setServiceId("")}
          disabled={isPending}
        >
          <X />
        </Button>
      )}
      <Button type="button" onClick={add} disabled={isPending || !serviceId}>
        {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
        {t.orders.addItem.addBtn}
      </Button>
    </div>
  );
}
