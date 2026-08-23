"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Loader2, Upload } from "lucide-react";
import { exportProductTemplate, importProducts } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";

export function ProductImportExport() {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [downloading, setDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    setDownloading(true);
    startTransition(async () => {
      const res = await exportProductTemplate();
      if (!res.ok) {
        toast.error(res.error);
        setDownloading(false);
        return;
      }
      const byteChars = atob(res.base64);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      setDownloading(false);
    });
  }

  function handleFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      const res = await importProducts(formData);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(res.message);
        router.refresh();
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={downloadTemplate} disabled={downloading}>
        {downloading ? <Loader2 className="animate-spin" /> : <Download />}
        {t.shop.downloadTemplate}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isPending}
      >
        {isPending ? <Loader2 className="animate-spin" /> : <Upload />}
        {t.shop.importFile}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
