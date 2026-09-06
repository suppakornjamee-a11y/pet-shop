import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { formatBaht, formatDate } from "@/lib/format";
import { getOrderKind } from "@/lib/order-kind";
import { isValidDateStr, thaiDayRange, todayThaiStr, toThaiDateStr } from "@/lib/slots";
import { PageHeader } from "@/components/page-header";
import { ReportRangePicker } from "@/components/report-range-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/get-locale";

/** ย้อนหลัง n วันนับถึงวันนี้ (รวมวันนี้) — ใช้เป็นช่วงเริ่มต้นตอนเปิดหน้ามาครั้งแรก */
function defaultFrom(days: number) {
  return toThaiDateStr(new Date(Date.now() - (days - 1) * 86_400_000));
}

export default async function ReportsPage(props: PageProps<"/reports">) {
  await requireAdmin();
  const t = getDictionary(await getLocale());
  const sp = await props.searchParams;

  const rawFrom = typeof sp.from === "string" ? sp.from : undefined;
  const rawTo = typeof sp.to === "string" ? sp.to : undefined;
  let from = rawFrom && isValidDateStr(rawFrom) ? rawFrom : defaultFrom(30);
  let to = rawTo && isValidDateStr(rawTo) ? rawTo : todayThaiStr();
  // เลือกวันสลับกันมาก็ไม่ต้องฟ้อง แค่สลับกลับให้ถูกทาง
  if (from > to) [from, to] = [to, from];

  const start = thaiDayRange(from).start;
  const end = thaiDayRange(to).end;

  // นับตามวันที่เปิดออเดอร์ — ตรงกับที่ร้านเข้าใจว่า "ขายได้เท่าไหร่ในช่วงนี้"
  // ออเดอร์ที่ยกเลิกไม่นับเป็นยอดขาย แต่ยังนับจำนวนไว้ให้เห็นแยกต่างหาก
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: start, lt: end } },
    select: {
      id: true,
      status: true,
      total: true,
      orderType: true,
      roomId: true,
      queueType: true,
      customerId: true,
      createdAt: true,
      extraCharges: { select: { amount: true } },
      payments: { select: { status: true, amount: true } },
      items: { select: { itemType: true, name: true, quantity: true, subtotal: true } },
    },
  });

  const live = orders.filter((o) => o.status !== "CANCELLED");
  const cancelledCount = orders.length - live.length;

  const orderValue = (o: (typeof orders)[number]) =>
    o.total + o.extraCharges.reduce((s, c) => s + c.amount, 0);
  const paidValue = (o: (typeof orders)[number]) =>
    o.payments.filter((p) => p.status === "VERIFIED").reduce((s, p) => s + p.amount, 0);

  const gross = live.reduce((s, o) => s + orderValue(o), 0);
  const collected = live.reduce((s, o) => s + paidValue(o), 0);
  const outstanding = Math.max(gross - collected, 0);
  const customers = new Set(live.map((o) => o.customerId).filter(Boolean)).size;

  /** จัดกลุ่มงานตามประเภท — บิลคาเฟ่แยกออกมา ที่เหลือใช้ตัวจัดประเภทเดียวกับทั้งระบบ */
  const kindOf = (o: (typeof orders)[number]) =>
    o.orderType === "SHOP" ? "CAFE" : getOrderKind(o);
  const kindLabels: Record<string, string> = {
    BATH: t.reports.kindBath,
    OTHER: t.reports.kindOther,
    BOARDING: t.reports.kindBoarding,
    CAFE: t.reports.kindCafe,
  };
  const byKind = ["BATH", "OTHER", "BOARDING", "CAFE"].map((kind) => {
    const rows = live.filter((o) => kindOf(o) === kind);
    return {
      kind,
      label: kindLabels[kind],
      count: rows.length,
      value: rows.reduce((s, o) => s + orderValue(o), 0),
    };
  });

  /** รายการที่ขายได้ แยกตามชนิด (บริการ / สินค้า) เรียงจากยอดมากไปน้อย */
  function topItems(itemType: "SERVICE" | "PRODUCT") {
    const map = new Map<string, { name: string; qty: number; value: number }>();
    for (const o of live) {
      for (const it of o.items) {
        if (it.itemType !== itemType) continue;
        const cur = map.get(it.name) ?? { name: it.name, qty: 0, value: 0 };
        cur.qty += it.quantity;
        cur.value += it.subtotal;
        map.set(it.name, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.value - a.value).slice(0, 10);
  }
  const topServices = topItems("SERVICE");
  const topProducts = topItems("PRODUCT");

  /** ยอดรายวัน — ไล่ทุกวันในช่วง แม้วันที่ไม่มีออเดอร์ก็ต้องขึ้นเป็น 0 ไม่งั้นจะดูเหมือนวันนั้นหายไป */
  const daily: { date: string; count: number; value: number }[] = [];
  for (let d = new Date(start); d < end; d = new Date(d.getTime() + 86_400_000)) {
    const key = toThaiDateStr(d);
    const rows = live.filter((o) => toThaiDateStr(o.createdAt) === key);
    daily.push({
      date: key,
      count: rows.length,
      value: rows.reduce((s, o) => s + orderValue(o), 0),
    });
  }
  const dailyPeak = Math.max(1, ...daily.map((d) => d.value));

  const summary = [
    { label: t.reports.gross, value: formatBaht(gross), hint: t.reports.grossHint },
    { label: t.reports.collected, value: formatBaht(collected), hint: t.reports.collectedHint },
    {
      label: t.reports.outstanding,
      value: formatBaht(outstanding),
      hint: t.reports.outstandingHint,
    },
    {
      label: t.reports.orderCount,
      value: String(live.length),
      hint: t.reports.orderCountHint(customers, cancelledCount),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.reports.title}
        description={t.reports.rangeLabel(
          formatDate(start),
          formatDate(new Date(end.getTime() - 1))
        )}
        action={<ReportRangePicker from={from} to={to} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((s) => (
          <Card key={s.label}>
            <CardContent className="py-4">
              <div className="text-sm text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                {s.value}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{s.hint}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.reports.byKindTitle}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="border-b bg-muted/50 text-muted-foreground">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4 font-medium">{t.reports.columnKind}</TableHead>
                <TableHead className="px-4 text-center font-medium">
                  {t.reports.columnCount}
                </TableHead>
                <TableHead className="px-4 text-right font-medium">
                  {t.reports.columnValue}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byKind.map((k) => (
                <TableRow key={k.kind}>
                  <TableCell className="px-4 py-3">{k.label}</TableCell>
                  <TableCell className="px-4 py-3 text-center tabular-nums">{k.count}</TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">
                    {formatBaht(k.value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopTable title={t.reports.topServicesTitle} rows={topServices} t={t} />
        <TopTable title={t.reports.topProductsTitle} rows={topProducts} t={t} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.reports.dailyTitle}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[28rem] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 border-b bg-muted text-muted-foreground">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 font-medium">{t.reports.columnDate}</TableHead>
                  <TableHead className="px-4 text-center font-medium">
                    {t.reports.columnCount}
                  </TableHead>
                  <TableHead className="px-4 font-medium">{t.reports.columnValue}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daily.map((d) => (
                  <TableRow key={d.date}>
                    <TableCell className="px-4 py-2 whitespace-nowrap">
                      {formatDate(thaiDayRange(d.date).start)}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-center tabular-nums">{d.count}</TableCell>
                    <TableCell className="px-4 py-2">
                      {/* แถบยาวตามสัดส่วนของวันที่ขายดีสุดในช่วง — เทียบวันต่อวันได้เร็วกว่าไล่อ่านตัวเลขทีละบรรทัด */}
                      <div className="flex items-center gap-2">
                        <div className="h-2 min-w-1 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${(d.value / dailyPeak) * 100}%` }}
                          />
                        </div>
                        <span className="w-20 shrink-0 text-right tabular-nums">
                          {formatBaht(d.value)}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TopTable({
  title,
  rows,
  t,
}: {
  title: string;
  rows: { name: string; qty: number; value: number }[];
  t: ReturnType<typeof getDictionary>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t.reports.noData}</p>
        ) : (
          <Table>
            <TableHeader className="border-b bg-muted/50 text-muted-foreground">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4 font-medium">{t.reports.columnItem}</TableHead>
                <TableHead className="px-4 text-center font-medium">
                  {t.reports.columnQty}
                </TableHead>
                <TableHead className="px-4 text-right font-medium">
                  {t.reports.columnValue}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="max-w-[16rem] truncate px-4 py-2">{r.name}</TableCell>
                  <TableCell className="px-4 py-2 text-center tabular-nums">{r.qty}</TableCell>
                  <TableCell className="px-4 py-2 text-right tabular-nums">
                    {formatBaht(r.value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
