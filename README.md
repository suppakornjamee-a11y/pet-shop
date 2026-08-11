# 🐾 PetCare — ระบบจัดการร้านอาบน้ำ / ตัดขน / ฝากเลี้ยงสัตว์

Web app สำหรับร้านบริการสัตว์เลี้ยง (อาบน้ำ ตัดขน ฝากเลี้ยง) พร้อมระบบชำระเงิน PromptPay QR,
คลังสินค้า, และระบบหลังบ้านสำหรับตั้งค่าร้าน

## เทคโนโลยี

- **Next.js 16** (App Router, Server Actions) + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (base-ui)
- **PostgreSQL** + **Prisma 7** (driver adapter `@prisma/adapter-pg`)
- **Auth.js v5** (NextAuth) — ล็อกอินด้วย username/password + สิทธิ์ตาม role
- **promptpay-qr** + **qrcode** — สร้าง QR PromptPay เอง (ไม่มีค่าธรรมเนียม)

## ฟีเจอร์

| ส่วน | รายละเอียด |
|------|-----------|
| 🔐 ล็อกอิน | แยกสิทธิ์ **ADMIN / MANAGER** (บางเมนูเข้าได้เฉพาะ Manager) |
| 🐶 ลงทะเบียน | กรอกข้อมูลเจ้าของ + สัตว์เลี้ยง (เพศ, สายพันธุ์, **อาการแพ้/ยาที่แพ้**) เพิ่มได้หลายตัว |
| 🧾 สร้างออเดอร์ | เลือกบริการ (อาบน้ำ/ตัดขน) + **ห้องพักตามขนาด** + สินค้า/ขนม → คิดราคาอัตโนมัติ |
| 💳 ชำระเงิน | สร้าง **QR PromptPay** อัตโนมัติ + **นับถอยหลัง 15 นาที** + ปุ่ม Gen ใหม่ + ยืนยัน/ปฏิเสธ |
| 🖨️ เอกสาร | พิมพ์ **ใบเสร็จ** + **สติกเกอร์ติดกรง** (มีแจ้งเตือนอาการแพ้) ผ่านหน้าเว็บ |
| 👥 ประวัติลูกค้า | ค้นหาด้วยชื่อ/เบอร์ · ดูสัตว์เลี้ยง · ประวัติบริการ · ยอดใช้จ่ายสะสม (3 sections) |
| 📊 แดชบอร์ด | ออเดอร์วันนี้ · รายรับวันนี้ · รอชำระ · ออเดอร์ล่าสุด |
| ⚙️ Setting | **Stock** สินค้า · **Room** ห้องพัก · **Bank account** (เฉพาะ Manager) · **User** จัดการสิทธิ์ |

## การติดตั้ง & รัน (Development)

ต้องรัน **2 อย่างพร้อมกัน** (คนละ terminal):

```bash
# 1) เปิดฐานข้อมูล Postgres (local Prisma Postgres — ไม่ต้องติดตั้ง Postgres แยก)
npm run db

# 2) เปิดเว็บแอป
npm run dev
```

เปิดเบราว์เซอร์ที่ **http://localhost:3000**

### บัญชีทดลอง

| สิทธิ์ | username | password |
|--------|----------|----------|
| ผู้ดูแลระบบ (Admin) | `admin` | `admin` |
| ผู้จัดการ (Manager) | `manager` | `manager` |

## คำสั่งที่ใช้บ่อย

```bash
npm run db          # เปิด local Prisma Postgres server
npm run dev         # เปิด dev server
npm run build       # build production
npm run db:migrate  # สร้าง/อัปเดต migration
npm run db:seed     # ใส่ข้อมูลตัวอย่าง (admin/manager, บริการ, ห้อง, สินค้า, บัญชี)
npm run db:studio   # เปิด Prisma Studio ดูข้อมูลในฐานข้อมูล
npm run db:reset    # ล้างฐานข้อมูล + migrate + seed ใหม่
```

## หมายเหตุการ deploy จริง (Production)

- เปลี่ยน `DATABASE_URL` ใน `.env` เป็น PostgreSQL จริง (เช่น Prisma Postgres cloud, Railway, Supabase)
- ตั้ง `AUTH_SECRET` เป็นค่าสุ่มที่ปลอดภัย
- ตั้งค่า **บัญชี PromptPay หลัก** ในเมนู Setting → Bank account (Manager) เพื่อให้ QR ใช้เบอร์จริง

## โครงสร้างหลัก

```
src/
├─ app/
│  ├─ (app)/              # โซนหลังล็อกอิน (มี sidebar) — force-dynamic
│  │  ├─ page.tsx         # แดชบอร์ด
│  │  ├─ register/        # ลงทะเบียนสัตว์เลี้ยง
│  │  ├─ orders/          # สร้าง/ดูออเดอร์ + ชำระเงิน
│  │  ├─ customers/       # ประวัติลูกค้า
│  │  └─ settings/        # stock, rooms, bank-accounts, users
│  ├─ login/              # หน้าล็อกอิน
│  ├─ print/orders/[id]/  # ใบเสร็จ + สติกเกอร์ (พิมพ์)
│  ├─ actions/            # Server Actions (customers, orders, settings)
│  └─ api/auth/           # Auth.js
├─ components/            # UI + ฟอร์ม + shadcn
├─ lib/                   # prisma, auth, promptpay, format, labels
└─ generated/prisma/      # Prisma Client (สร้างอัตโนมัติ)
```

## สิ่งที่ยังไม่ได้ทำ (เฟสถัดไป)

- ฝั่งคาเฟ่ (หน้าขาย POS ของคน) — โครงฐานข้อมูลรองรับแล้ว (`Product.target = HUMAN`)
- ดูกล้อง Xiaomi live (ต้อง restream ผ่าน go2rtc/MediaMTX)
- อัปโหลดไฟล์สลิปจริง (ตอนนี้ใช้ปุ่มยืนยันโดยแอดมิน)
- Export Excel รายงาน
