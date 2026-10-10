// BookingTicket.tsx
// การ์ด "ตั๋วจอง" หน้า การจองของฉัน · React + Tailwind
// ฟอนต์: Prompt (Google Fonts) น้ำหนัก 400/500/600/700
// แถบขั้นตอนด้านบน (จองคิว → รอดำเนินการ) ใช้ของเดิมในแอป ไม่ได้อยู่ในไฟล์นี้

type BookingTicketProps = {
  statusLabel?: string;        // เช่น "รอดำเนินการ"
  serviceName: string;         // เช่น "อาบน้ำตัดขน"
  petName: string;             // เช่น "ลูก้า"
  petType: string;             // เช่น "แมว"
  dateText: string;            // เช่น "ส. 17 ต.ค. 2569"
  timeText: string;            // เช่น "12:30 น."
  mainItems: string[];         // บริการหลัก
  extraItems: string[];        // บริการเสริม
  freeItems: string[];         // บริการฟรี
  total: number;               // ยอดรวมโดยประมาณ
  deposit: number;             // มัดจำที่ชำระแล้ว
  serviceIconSrc?: string;     // ไอคอนแมวในอ่าง (PNG พื้นใส)
};

const baht = (n: number) => n.toLocaleString("en-US");

function PawBg() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="#fff"
      aria-hidden="true"
      className="pointer-events-none absolute -right-[30px] top-10 h-[150px] w-[150px] -rotate-[18deg] opacity-[0.08]"
    >
      <circle cx="8.5" cy="5.5" r="2" />
      <circle cx="15.5" cy="5.5" r="2" />
      <circle cx="4.5" cy="10.5" r="2" />
      <circle cx="19.5" cy="10.5" r="2" />
      <path d="M12 11c-3 0-6 4.3-6 6.8a2.4 2.4 0 0 0 3 2.3c1-.3 2-.6 3-.6s2 .3 3 .6a2.4 2.4 0 0 0 3-2.3c0-2.5-3-6.8-6-6.8z" />
    </svg>
  );
}

function ItemGroup({
  title,
  items,
  dotClass,
  free = false,
}: {
  title: string;
  items: string[];
  dotClass: string;
  free?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[14.5px] font-semibold">{title}</span>
        <span className="text-[12.5px] text-[#8A6B76]">· {items.length} รายการ</span>
        {free && (
          <span className="ml-auto rounded-full bg-[#E8F5EC] px-[9px] py-0.5 text-[11.5px] font-semibold text-[#1E7A44]">
            ไม่มีค่าใช้จ่าย
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {items.map((it) => (
          <div key={it} className="flex items-start gap-2 text-[14px] leading-[1.45]">
            <span className={`mt-2 h-1.5 w-1.5 flex-none rounded-full ${dotClass}`} />
            {it}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BookingTicket({
  statusLabel = "รอดำเนินการ",
  serviceName,
  petName,
  petType,
  dateText,
  timeText,
  mainItems,
  extraItems,
  freeItems,
  total,
  deposit,
  serviceIconSrc = "/bath-icon.png",
}: BookingTicketProps) {
  const count = mainItems.length + extraItems.length + freeItems.length;
  const remain = Math.max(total - deposit, 0);

  return (
    <article className="font-['Prompt'] text-[#2A1A20] [filter:drop-shadow(0_14px_22px_rgba(120,40,70,0.14))]">
      {/* ===== หัวตั๋ว ===== */}
      <div className="relative flex flex-col gap-[18px] overflow-hidden rounded-t-[26px] bg-[#B8456F] px-[18px] pb-[22px] pt-[18px] text-white">
        <PawBg />

        {/* สถานะ */}
        <div className="relative flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#B8456F]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="5 12 10 17 19 7" />
              </svg>
            </span>
            <span className="text-[16px] font-bold">ยืนยันการจองแล้ว</span>
          </div>
          <span className="rounded-full bg-white/20 px-[11px] py-1 text-[12px] font-semibold">
            {statusLabel}
          </span>
        </div>

        {/* บริการ + น้อง */}
        <div className="relative flex items-center gap-3.5">
          <div className="flex h-[60px] w-[60px] flex-none items-center justify-center rounded-[20px] bg-white">
            {/* ไอคอนเป็นสี #B8456F ด้วย CSS mask (ไฟล์ PNG พื้นใสสีอะไรก็ได้) */}
            <span
              aria-hidden="true"
              className="h-[38px] w-[38px] bg-[#B8456F] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
              style={{ maskImage: `url(${serviceIconSrc})`, WebkitMaskImage: `url(${serviceIconSrc})` }}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[22px] font-bold leading-[1.2]">{serviceName}</span>
            <span className="text-[14px] text-white/[0.88]">
              {petName} · {petType}
            </span>
          </div>
        </div>

        {/* วันที่ + เวลา */}
        <div className="relative grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-[14px] bg-white/[0.16] px-3 py-[11px] text-[14.5px] font-semibold">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="17" rx="3" />
              <path d="M3 9h18M8 2v4M16 2v4" />
            </svg>
            {dateText}
          </div>
          <div className="flex items-center gap-2 rounded-[14px] bg-white/[0.16] px-3 py-[11px] text-[14.5px] font-semibold">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            {timeText}
          </div>
        </div>
      </div>

      {/* ===== รอยปรุกลางตั๋ว ===== */}
      {/* วงกลมซ้ายขวาต้องเป็นสีเดียวกับพื้นหลังหน้า (#FBEFF3) */}
      <div className="relative h-[26px] bg-white">
        <span className="absolute -left-[13px] top-0 h-[26px] w-[26px] rounded-full bg-[#FBEFF3]" />
        <span className="absolute -right-[13px] top-0 h-[26px] w-[26px] rounded-full bg-[#FBEFF3]" />
        <span className="absolute left-[22px] right-[22px] top-3 border-t-2 border-dashed border-[#EBD6DF]" />
      </div>

      {/* ===== ตัวตั๋ว ===== */}
      <div className="flex flex-col gap-[18px] rounded-b-[26px] bg-white px-[18px] pb-5 pt-1.5">
        <div className="flex items-baseline justify-between">
          <h2 className="m-0 text-[17px] font-bold">รายการบริการ</h2>
          <span className="text-[13px] text-[#8A6B76]">{count} รายการ</span>
        </div>

        <ItemGroup title="บริการหลัก" items={mainItems} dotClass="bg-[#B8456F]" />
        <ItemGroup title="บริการเสริม" items={extraItems} dotClass="bg-[#E0A3BA]" />
        <ItemGroup title="บริการฟรี" items={freeItems} dotClass="bg-[#9CCFAE]" free />

        {/* สรุปยอด */}
        <div className="flex flex-col gap-2.5 rounded-[18px] bg-[#FBF5F7] p-4">
          <div className="flex items-center justify-between text-[14px]">
            <span className="text-[#6B5A61]">ยอดรวมโดยประมาณ</span>
            <span className="font-semibold">฿{baht(total)}</span>
          </div>
          <div className="flex items-center justify-between text-[14px]">
            <span className="flex items-center gap-1.5">
              <span className="text-[#6B5A61]">มัดจำ</span>
              <span className="rounded-md bg-[#E8F5EC] px-[7px] py-px text-[11px] font-semibold text-[#1E7A44]">
                ชำระแล้ว
              </span>
            </span>
            <span className="font-semibold text-[#1E7A44]">-฿{baht(deposit)}</span>
          </div>
          <div className="my-0.5 border-t-[1.5px] border-dashed border-[#E6D2DA]" />
          <div className="flex items-end justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold">ยอดคงเหลือโดยประมาณ</span>
              <span className="text-[11px] text-[#8A6B76]">ชำระหลังจากอาบน้ำเสร็จ</span>
            </div>
            <div className="flex items-baseline gap-0.5 leading-none text-[#B8456F]">
              <span className="text-[16px] font-semibold">฿</span>
              <span className="text-[26px] font-bold tracking-[-0.5px]">{baht(remain)}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ===== ตัวอย่างการใช้งาน =====
<main className="mx-auto flex max-w-[390px] flex-col gap-4 bg-[#FBEFF3] px-4 pb-6 pt-5 font-['Prompt']">
  <h1 className="mx-1 text-[24px] font-bold text-[#2A1A20]">การจองของฉัน</h1>
  {/* แถบขั้นตอนเดิมของแอป *\/}
  <BookingTicket
    serviceName="อาบน้ำตัดขน"
    petName="ลูก้า"
    petType="แมว"
    dateText="ส. 17 ต.ค. 2569"
    timeText="12:30 น."
    mainItems={["อาบน้ำพิเศษ", "ตัดขนยาว"]}
    extraItems={["สางขนพันกัน", "Paws & Nose Moisturizer", "ลดคราบน้ำตา", "เกลือกุหลาบ", "ทาแป้งลดคราบน้ำตา"]}
    freeItems={["ไถเท้า", "ไถท้อง", "ไถก้น", "บีบต่อม", "เช็ดหู"]}
    total={1750}
    deposit={300}
  />
</main>
*/
