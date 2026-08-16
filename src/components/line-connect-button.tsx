"use client";

import { useEffect, useState } from "react";
import { MessageCircle, QrCode } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function LineConnectButton({
  linked,
  linkUrl,
}: {
  linked: boolean;
  linkUrl: string | null;
}) {
  const { t } = useI18n();

  if (linked) {
    return (
      <Badge variant="secondary" className="gap-1 text-emerald-700 dark:text-emerald-400">
        <MessageCircle className="h-3 w-3" /> {t.customers.lineConnected}
      </Badge>
    );
  }

  if (!linkUrl) {
    return (
      <span className="text-xs text-muted-foreground">{t.customers.lineConnectUnavailable}</span>
    );
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <QrCode className="h-3.5 w-3.5" /> {t.customers.lineConnectButton}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.customers.lineConnectDialogTitle}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t.customers.lineConnectDialogDesc}</p>
        <LineQr url={linkUrl} />
      </DialogContent>
    </Dialog>
  );
}

function LineQr({ url }: { url: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    import("qrcode")
      .then((mod) =>
        mod.default.toDataURL(url, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 260,
        })
      )
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) setQrDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [url]);

  if (!qrDataUrl) {
    return <div className="mx-auto h-[260px] w-[260px] animate-pulse rounded-lg bg-muted" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={qrDataUrl} alt="LINE QR" width={260} height={260} className="mx-auto rounded-lg" />
  );
}
