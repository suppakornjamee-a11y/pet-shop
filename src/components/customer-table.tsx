"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { Search, Users, Smartphone, Loader2, FileText } from "lucide-react";
import { listCustomers, type CustomerFilter } from "@/app/actions/customers";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/components/i18n-provider";
import { SpeciesIcon } from "@/components/species-icon";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Pet = { id: string; name: string; species: "DOG" | "CAT" };
export type CustomerRow = {
  id: string;
  name: string;
  nickname: string | null;
  phone: string;
  createdAt: string;
  createdVia: "STAFF" | "LIFF";
  lineLinked: boolean;
  pets: Pet[];
  visitCount: number;
  lastVisitAt: string | null;
};

export function CustomerTable({ initial }: { initial: CustomerRow[] }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [createdVia, setCreatedVia] = useState<NonNullable<CustomerFilter["createdVia"]>>("ALL");
  const [species, setSpecies] = useState<NonNullable<CustomerFilter["species"]>>("ALL");
  const [rows, setRows] = useState<CustomerRow[]>(initial);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      startTransition(async () => {
        const res = await listCustomers({ query, createdVia, species });
        setRows(res as CustomerRow[]);
      });
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [query, createdVia, species]);

  return (
    <div className="space-y-4">
      {/* แถบค้นหา + ตัวกรอง */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.customers.searchPlaceholder}
            className="pl-9"
          />
        </div>
        <Select
          value={createdVia}
          onValueChange={(v) => setCreatedVia(v as typeof createdVia)}
          items={[
            { value: "ALL", label: t.customers.filterChannelAll },
            { value: "STAFF", label: t.customers.filterChannelStaff },
            { value: "LIFF", label: t.customers.filterChannelLiff },
          ]}
        >
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t.customers.filterChannelAll}</SelectItem>
            <SelectItem value="STAFF">{t.customers.filterChannelStaff}</SelectItem>
            <SelectItem value="LIFF">{t.customers.filterChannelLiff}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={species}
          onValueChange={(v) => setSpecies(v as typeof species)}
          items={[
            { value: "ALL", label: t.customers.filterSpeciesAll },
            { value: "DOG", label: t.labels.species.DOG },
            { value: "CAT", label: t.labels.species.CAT },
          ]}
        >
          <SelectTrigger className="sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t.customers.filterSpeciesAll}</SelectItem>
            <SelectItem value="DOG">{t.labels.species.DOG}</SelectItem>
            <SelectItem value="CAT">{t.labels.species.CAT}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="border-b bg-muted/50 text-muted-foreground">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4 font-medium text-muted-foreground">
                  {t.customers.columnCustomer}
                </TableHead>
                <TableHead className="px-4 font-medium text-muted-foreground">
                  {t.customers.columnPets}
                </TableHead>
                <TableHead className="px-4 font-medium text-muted-foreground">
                  {t.customers.columnPhone}
                </TableHead>
                <TableHead className="px-4 text-center font-medium text-muted-foreground">
                  {t.customers.columnVisitCount}
                </TableHead>
                <TableHead className="px-4 font-medium text-muted-foreground">
                  {t.customers.columnLastVisit}
                </TableHead>
                <TableHead className="w-16 px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      {isPending ? (
                        <Loader2 className="h-8 w-8 animate-spin opacity-40" />
                      ) : (
                        <Users className="h-8 w-8 opacity-40" />
                      )}
                      {isPending ? t.customers.searching : t.customers.notFound}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{c.name}</span>
                        {c.createdVia === "LIFF" && (
                          <Badge
                            variant="outline"
                            className="gap-1 text-[10px] text-sky-700 dark:text-sky-400"
                          >
                            <Smartphone className="h-3 w-3" /> Line
                          </Badge>
                        )}
                      </div>
                      {c.nickname && (
                        <div className="text-xs text-muted-foreground">{c.nickname}</div>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {c.pets.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          {c.pets.map((p) => (
                            <span key={p.id} className="inline-flex items-center gap-1">
                              <SpeciesIcon species={p.species} className="h-3.5 w-3.5" />
                              {p.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 tabular-nums">{c.phone}</TableCell>
                    <TableCell className="px-4 py-3 text-center tabular-nums">
                      {c.visitCount}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {c.lastVisitAt ? formatDate(c.lastVisitAt) : "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <Button
                        render={<Link href={`/customers/${c.id}`} />}
                        nativeButton={false}
                        variant="ghost"
                        size="icon"
                        aria-label={t.customers.viewDetail}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <p className="text-xs text-muted-foreground">{t.customers.resultCount(rows.length)}</p>
      )}
    </div>
  );
}
