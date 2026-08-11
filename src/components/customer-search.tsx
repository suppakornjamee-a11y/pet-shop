"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { Search, Phone, ChevronRight, Users } from "lucide-react";
import { searchCustomers } from "@/app/actions/customers";
import { speciesEmoji } from "@/lib/labels";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type Pet = { id: string; name: string; species: "DOG" | "CAT" };
type Customer = { id: string; name: string; phone: string; pets: Pet[] };

export function CustomerSearch({ initial }: { initial: Customer[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>(initial);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => {
      startTransition(async () => {
        const res = await searchCustomers(query);
        setResults(res as Customer[]);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาด้วยชื่อลูกค้าหรือเบอร์โทร..."
          className="pl-9"
        />
      </div>

      {results.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Users className="h-10 w-10 opacity-40" />
            {isPending ? "กำลังค้นหา..." : "ไม่พบลูกค้า"}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {results.map((c) => (
            <Link key={c.id} href={`/customers/${c.id}`}>
              <Card className="transition-colors hover:border-primary hover:bg-accent/40">
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" /> {c.phone}
                    </div>
                    <div className="mt-1 text-sm">
                      {c.pets.length > 0
                        ? c.pets.map((p) => `${speciesEmoji[p.species]} ${p.name}`).join("  ")
                        : "— ยังไม่มีสัตว์เลี้ยง"}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
