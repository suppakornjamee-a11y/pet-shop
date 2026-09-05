type IconProps = { className?: string };

/** ไอคอนประวัติ/เวชระเบียนลูกค้า — คลิปบอร์ด + คนไข้ + กาชาด + ดินสอ สไตล์ outline สี (ใช้กับประวัติลูกค้า) */
export function CustomerRecordFlatIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="3.4" width="15.5" height="18.6" rx="2" fill="#935E34" stroke="#1A1A1A" strokeWidth="0.7" />
      <rect x="4.4" y="5.3" width="12.7" height="15.3" rx="1" fill="#E3F2FD" stroke="#1A1A1A" strokeWidth="0.5" />
      <path
        d="M8.3 1.6C8.3 1.05 8.75 0.6 9.3 0.6H12.7C13.25 0.6 13.7 1.05 13.7 1.6V4.2H8.3V1.6Z"
        fill="#14B8A6"
        stroke="#1A1A1A"
        strokeWidth="0.6"
      />
      <circle cx="11" cy="2.4" r="0.55" fill="#0D3B3A" />
      <circle cx="7.6" cy="9.2" r="1.5" fill="#EAC49A" stroke="#1A1A1A" strokeWidth="0.4" />
      <path
        d="M5.5 13.1C5.5 11.66 6.44 10.6 7.6 10.6C8.76 10.6 9.7 11.66 9.7 13.1V13.4H5.5V13.1Z"
        fill="#8C93EB"
        stroke="#1A1A1A"
        strokeWidth="0.4"
      />
      <rect x="11.6" y="7.4" width="3.7" height="3.7" rx="0.5" fill="#4FC3F7" stroke="#1A1A1A" strokeWidth="0.4" />
      <path d="M13.1 8.15H14.05V9H14.9V9.95H14.05V10.8H13.1V9.95H12.25V9H13.1V8.15Z" fill="#1A1A1A" />
      <rect x="5.5" y="14.9" width="8.4" height="0.9" rx="0.45" fill="#333333" />
      <rect x="5.5" y="16.5" width="8.4" height="0.9" rx="0.45" fill="#333333" />
      <rect x="5.5" y="18.1" width="5.6" height="0.9" rx="0.45" fill="#333333" />
      <g transform="rotate(45 17.3 15)">
        <rect x="15.9" y="8.8" width="2.8" height="9.4" rx="0.9" fill="#FFC94D" stroke="#1A1A1A" strokeWidth="0.5" />
        <rect x="15.9" y="7.3" width="2.8" height="2" fill="#E0645F" stroke="#1A1A1A" strokeWidth="0.5" />
        <path d="M15.9 18.2L17.3 20.4L18.7 18.2Z" fill="#5A5A5A" stroke="#1A1A1A" strokeWidth="0.5" />
      </g>
    </svg>
  );
}

/** ไอคอนเอกสาร/ใบเสร็จ — สไตล์ flat สีเทา (ใช้กับออเดอร์ทั้งหมด) */
export function DocumentFlatIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M8.5 4.5C8.5 3.67 9.17 3 10 3H15L19 7V20.5C19 21.33 18.33 22 17.5 22H10C9.17 22 8.5 21.33 8.5 20.5V4.5Z" fill="#C9CCD3" />
      <path
        d="M7 3.5C7 2.67 7.67 2 8.5 2H14L18 6V19.5C18 20.33 17.33 21 16.5 21H8.5C7.67 21 7 20.33 7 19.5V3.5Z"
        fill="#F1F2F4"
      />
      <path d="M14 2L18 6H15.2C14.54 6 14 5.46 14 4.8V2Z" fill="#48566B" />
      <rect x="9.5" y="10.5" width="6" height="1.4" rx="0.7" fill="#48566B" />
      <rect x="9.5" y="13.3" width="6" height="1.4" rx="0.7" fill="#AEB2BB" />
      <rect x="9.5" y="16.1" width="3.8" height="1.4" rx="0.7" fill="#AEB2BB" />
    </svg>
  );
}

/** ไอคอนคลิปบอร์ด — สไตล์ flat สีทอง/เทา (ใช้กับลงทะเบียนสัตว์เลี้ยง) */
export function ClipboardFlatIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="5" y="4" width="14" height="17" rx="2" fill="#E9EAEC" stroke="#D2AF71" strokeWidth="1" />
      <rect x="8.25" y="2.3" width="7.5" height="3.6" rx="1.1" fill="#D2AF71" />
      <circle cx="12" cy="4.1" r="0.9" fill="#B98F55" />
      <rect x="7.5" y="10.2" width="9" height="1.4" rx="0.7" fill="#48566B" />
      <rect x="7.5" y="13" width="9" height="1.4" rx="0.7" fill="#AEB2BB" />
      <rect x="7.5" y="15.8" width="5.8" height="1.4" rx="0.7" fill="#AEB2BB" />
    </svg>
  );
}

/** ไอคอนกล่องสต็อก — สไตล์ flat สีน้ำตาล/แดงอิฐ (ใช้กับสินค้า/สต็อก) */
export function StockFlatIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="12" width="8.5" height="8" rx="1.3" fill="#B98F55" />
      <rect x="4.7" y="15.4" width="5.1" height="1.9" rx="0.4" fill="#C1666B" />
      <rect x="9.5" y="4.5" width="11.5" height="11.5" rx="1.5" fill="#D2AF71" />
      <rect x="9.5" y="9.25" width="11.5" height="2.4" fill="#C1666B" />
      <rect x="13.7" y="7" width="2.8" height="1.6" rx="0.6" fill="#48566B" />
    </svg>
  );
}

/** ไอคอนปฏิทิน — สไตล์ flat สีน้ำตาล/แดงอิฐ (variant: day = คิวเดี่ยว, range = ช่วงหลายวัน) */
export function CalendarFlatIcon({
  className,
  variant = "day",
}: IconProps & { variant?: "day" | "range" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" fill="#E9DDC2" />
      <path d="M3 7.5C3 6.12 4.12 5 5.5 5H18.5C19.88 5 21 6.12 21 7.5V9.8H3V7.5Z" fill="#D2685F" />
      <rect x="6.8" y="2.5" width="2" height="4.4" rx="1" fill="#48566B" />
      <rect x="15.2" y="2.5" width="2" height="4.4" rx="1" fill="#48566B" />
      {variant === "range" ? (
        <rect x="6" y="13.2" width="12" height="3.2" rx="1.6" fill="#B98F55" />
      ) : (
        <circle cx="12" cy="14.8" r="2.4" fill="#48566B" />
      )}
    </svg>
  );
}

export function CalendarDayFlatIcon({ className }: IconProps) {
  return <CalendarFlatIcon className={className} variant="day" />;
}

export function CalendarRangeFlatIcon({ className }: IconProps) {
  return <CalendarFlatIcon className={className} variant="range" />;
}

/** ไอคอนแดชบอร์ด — จอมอนิเตอร์ + กราฟแท่ง สไตล์ flat สีฟ้า */
export function DashboardFlatIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="3.5" width="20" height="14" rx="2" fill="#2E6FE0" />
      <rect x="3.4" y="4.9" width="17.2" height="11.2" rx="1.1" fill="#BAE6FD" />
      <rect x="5.8" y="11.4" width="2.3" height="3.8" rx="0.5" fill="#EF5C6E" />
      <rect x="9" y="9.2" width="2.3" height="6" rx="0.5" fill="#FFC94D" />
      <rect x="12.2" y="10.4" width="2.3" height="4.8" rx="0.5" fill="#5ED17E" />
      <rect x="15.4" y="7.4" width="2.3" height="7.8" rx="0.5" fill="#2E6FE0" />
      <path d="M9.5 18.5C9.5 17.95 9.95 17.5 10.5 17.5H13.5C14.05 17.5 14.5 17.95 14.5 18.5V20.3H9.5V18.5Z" fill="#2E6FE0" />
      <rect x="6.8" y="20.3" width="10.4" height="1.7" rx="0.85" fill="#2E6FE0" />
    </svg>
  );
}

/** ไอคอนแดชบอร์ด — รูปภาพกราฟสถิติที่ผู้ใช้เตรียมมาให้ */
export function DashboardImageIcon({ className }: IconProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/icons/dashboard.png" alt="" className={className} />;
}

/** ไอคอนวันหยุด — รูปภาพปฏิทินริมชายหาดที่ผู้ใช้เตรียมมาให้ */
export function HolidayImageIcon({ className }: IconProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/icons/holiday.png" alt="" className={className} />;
}

/** ไอคอนจองโรงแรม/ห้องพัก — รูปภาพบ้านสุนัขที่ผู้ใช้เตรียมมาให้ */
export function BoardingImageIcon({ className }: IconProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/icons/boarding.png" alt="" className={className} />;
}

/** ไอคอนประวัติลูกค้า — รูปภาพเอกสารประวัติ+แว่นขยายที่ผู้ใช้เตรียมมาให้ */
export function CustomersImageIcon({ className }: IconProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/icons/customers.png" alt="" className={className} />;
}

/** ไอคอนรายการอาหาร/สินค้า — รูปภาพที่ผู้ใช้เตรียมมาให้ */
export function StockImageIcon({ className }: IconProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/icons/stock.png" alt="" className={className} />;
}

/** ไอคอนห้องพัก — รูปภาพเตียงนอนที่ผู้ใช้เตรียมมาให้ */
export function RoomsImageIcon({ className }: IconProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/icons/rooms.png" alt="" className={className} />;
}

/** ไอคอนข้อมูลร้าน — รูปภาพหน้าร้านคาเฟ่ที่ผู้ใช้เตรียมมาให้ */
export function ShopInfoImageIcon({ className }: IconProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/icons/shop-info.png" alt="" className={className} />;
}

/** ไอคอนรายงาน — รูปภาพวิเคราะห์ข้อมูลที่ผู้ใช้เตรียมมาให้ */
export function ReportsImageIcon({ className }: IconProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/icons/reports.png" alt="" className={className} />;
}

/** ไอคอนออเดอร์ — รูปภาพปฏิทินติ๊กถูกที่ผู้ใช้เตรียมมาให้ */
export function OrdersImageIcon({ className }: IconProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/icons/orders.png" alt="" className={className} />;
}

/** ไอคอนร้านอาหาร — รูปภาพรถเข็นขายอาหารที่ผู้ใช้เตรียมมาให้ */
export function ShopImageIcon({ className }: IconProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/icons/shop.png" alt="" className={className} />;
}

/** ไอคอนลงทะเบียน — รูปภาพกระดานเช็คลิสต์ที่ผู้ใช้เตรียมมาให้ */
export function RegisterImageIcon({ className }: IconProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/icons/register.png" alt="" className={className} />;
}

/** ไอคอนจองอาบน้ำ — รูปภาพหมาอาบน้ำในอ่างที่ผู้ใช้เตรียมมาให้ */
export function BathCalendarImageIcon({ className }: IconProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/icons/bath-calendar.png" alt="" className={className} />;
}

/** ไอคอนบัญชีธนาคาร — รูปภาพมือถือ+เหรียญเงินที่ผู้ใช้เตรียมมาให้ */
export function BankAccountsImageIcon({ className }: IconProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/icons/bank-accounts.png" alt="" className={className} />;
}

/** ไอคอนออกจากระบบ — รูปภาพคนก้าวออกประตูที่ผู้ใช้เตรียมมาให้ */
export function LogoutImageIcon({ className }: IconProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/icons/logout.png" alt="" className={className} />;
}

/** ไอคอนผู้ใช้งาน — อวตารในวงกลม สไตล์ flat สีฟ้า */
export function UserAvatarFlatIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="10" fill="#BFDBFE" />
      <path
        d="M7.2 20.2C7.6 16.9 9.6 14.8 12 14.8C14.4 14.8 16.4 16.9 16.8 20.2C15.4 21.3 13.76 22 12 22C10.24 22 8.6 21.3 7.2 20.2Z"
        fill="#2C4A63"
      />
      <path d="M10.5 15.6H13.5L13.1 17.6H10.9L10.5 15.6Z" fill="#FFFFFF" />
      <path d="M10.9 17.6H13.1L12.5 19.4H11.5L10.9 17.6Z" fill="#D9646E" />
      <circle cx="12" cy="10.4" r="4.1" fill="#FFCBB0" />
      <path
        d="M7.9 10.2C8.1 7.6 9.8 5.8 12 5.8C14.2 5.8 15.9 7.6 16.1 10.2C15.4 9.6 14.3 9.6 13.6 8.9C13.1 9.6 12.1 9.9 11 9.6C10 9.3 9.3 8.7 8.9 8.1C8.5 8.7 8.1 9.4 7.9 10.2Z"
        fill="#1E3A52"
      />
    </svg>
  );
}

/** ไอคอนบัญชี/ชำระเงิน — มือถือ + ยืนยันสำเร็จ สไตล์ flat สีม่วง/เขียว */
export function BankPaymentFlatIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="5" y="2" width="14" height="20" rx="3" fill="#5B3E99" />
      <rect x="6.6" y="4.4" width="10.8" height="14.2" rx="1.3" fill="#EAF4FF" />
      <rect x="9.5" y="5.6" width="5" height="1.3" rx="0.65" fill="#8B6FC7" />
      <rect x="8.6" y="9" width="6.8" height="2.1" rx="1.05" fill="#8BC34A" />
      <rect x="8.6" y="11.8" width="6.8" height="2.1" rx="1.05" fill="#8BC34A" />
      <circle cx="16.6" cy="16.4" r="3.7" fill="#17A589" />
      <path
        d="M14.85 16.5L15.95 17.6L18.25 15.2"
        stroke="white"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/** ไอคอนห้องพัก — เตียง สไตล์ flat สีม่วง/ทอง */
export function BedFlatIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="9" width="18" height="9" rx="1.8" fill="#EDEBF7" />
      <path d="M3 13.5C3 12.12 4.12 11 5.5 11H18.5C19.88 11 21 12.12 21 13.5V15H3V13.5Z" fill="#C9C3E8" />
      <rect x="4.5" y="11.6" width="5.5" height="3" rx="1.3" fill="#FFFFFF" />
      <rect x="10.5" y="11.6" width="5.5" height="3" rx="1.3" fill="#FFFFFF" />
      <rect x="2.2" y="6.5" width="3.4" height="11.5" rx="1" fill="#4A3F73" />
      <rect x="2.2" y="6.5" width="3.4" height="4.2" rx="1" fill="#7B68B5" />
      <rect x="3" y="17.6" width="2" height="3" rx="0.5" fill="#C9973F" />
      <rect x="19" y="17.6" width="2" height="3" rx="0.5" fill="#C9973F" />
    </svg>
  );
}
