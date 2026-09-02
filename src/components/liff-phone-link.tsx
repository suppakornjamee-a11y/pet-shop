"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search, UserRound } from "lucide-react";
import { liffFindCustomerByPhone, liffConfirmLink } from "@/app/actions/liff";
import { useLiff, LiffGate, handleLiffAuthExpiry } from "@/components/liff-provider";
import { useI18n } from "@/components/i18n-provider";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

type Match = { customerId: string; maskedName: string; petSummary: string };

function LinkBody() {
  const { t } = useI18n();
  const router = useRouter();
  const { idToken } = useLiff();
  const [phone, setPhone] = useState("");
  const [searched, setSearched] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isPending, startTransition] = useTransition();

  function search() {
    if (!idToken || !phone.trim()) return;
    startTransition(async () => {
      const res = await liffFindCustomerByPhone(idToken, phone.trim());
      if (!res.ok) {
        handleLiffAuthExpiry(res);
        toast.error(res.error);
        return;
      }
      setMatches(res.matches);
      setSearched(true);
    });
  }

  function confirm(customerId: string) {
    if (!idToken) return;
    startTransition(async () => {
      const res = await liffConfirmLink(idToken, customerId);
      if (!res.ok) {
        handleLiffAuthExpiry(res);
        toast.error(res.error);
        return;
      }
      toast.success(t.liff.linkSuccess);
      router.push("/liff/book");
    });
  }

  return (
    <div>
      <PageHeader title={t.liff.linkPageTitle} description={t.liff.linkPageDescription} />
      <div className="space-y-2">
        <Label>{t.liff.phoneLabel}</Label>
        <div className="flex gap-2">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.liff.phonePlaceholder}
            inputMode="tel"
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <Button onClick={search} disabled={isPending || !phone.trim()}>
            {isPending ? <Loader2 className="animate-spin" /> : <Search />}
            {t.liff.searchButton}
          </Button>
        </div>
      </div>

      {searched && matches.length === 0 && (
        <div className="mt-6 space-y-3 text-center">
          <p className="text-sm text-muted-foreground">{t.liff.noMatchesFound}</p>
          <p className="text-xs text-muted-foreground">{t.liff.noMatchesHint}</p>
          <Button variant="outline" onClick={() => router.push("/liff/register")}>
            {t.liff.registerInsteadButton}
          </Button>
        </div>
      )}

      {matches.length > 0 && (
        <div className="mt-6 space-y-2">
          {matches.map((m) => (
            <Card key={m.customerId}>
              <CardContent className="flex items-center justify-between gap-3 p-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserRound className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="font-medium">{m.maskedName}</div>
                    <div className="text-xs text-muted-foreground">{m.petSummary}</div>
                  </div>
                </div>
                <Button size="sm" onClick={() => confirm(m.customerId)} disabled={isPending}>
                  {t.liff.confirmThisIsMe}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function LiffPhoneLink() {
  return (
    <LiffGate>
      <LinkBody />
    </LiffGate>
  );
}
