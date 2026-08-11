# 🚀 Deploy ขึ้น Vercel (สำหรับ Demo)

> local database (`prisma dev`) ใช้บน Vercel ไม่ได้ ต้องใช้ **cloud PostgreSQL**
> คู่มือนี้ใช้ **Neon** (ฟรี เชื่อมกับ Vercel ได้ในคลิกเดียว)

## ภาพรวม 5 ขั้นตอน
1. push โค้ดขึ้น GitHub
2. Import repo เข้า Vercel
3. เพิ่ม Database (Neon) → ได้ `DATABASE_URL` อัตโนมัติ
4. ใส่ env `AUTH_SECRET`, `AUTH_TRUST_HOST`
5. Deploy → seed ข้อมูลตัวอย่าง

---

## 1) Push โค้ดขึ้น GitHub

โปรเจกต์ commit ไว้ให้แล้ว เหลือสร้าง repo แล้ว push:

1. สร้าง repo ใหม่ (ว่างๆ) ที่ https://github.com/new เช่นชื่อ `petcare-app` (Private ก็ได้)
2. รันคำสั่ง (แทน `<URL>` ด้วย URL repo ที่เพิ่งสร้าง):

```bash
cd C:\Users\SuppakornJame\petcare-app
git remote add origin <URL>   # เช่น https://github.com/USERNAME/petcare-app.git
git branch -M main
git push -u origin main
```

## 2) Import เข้า Vercel

- ไปที่ https://vercel.com/new → เลือก repo `petcare-app` → **Import**
- Framework จะถูกตรวจเป็น **Next.js** อัตโนมัติ — ยังไม่ต้องกด Deploy (ทำ step 3-4 ก่อน)

## 3) เพิ่ม Database (Neon)

- ในหน้าโปรเจกต์ Vercel → แท็บ **Storage** → **Create Database** → เลือก **Neon** (Postgres)
- เชื่อมเสร็จ Vercel จะเพิ่ม env `DATABASE_URL` ให้อัตโนมัติ
- **สำคัญ:** ใช้ connection string แบบ **Pooled** (มี `-pooler`) และมี `?sslmode=require`

> ถ้าใช้เจ้าอื่น (Supabase/Railway/Prisma Postgres) ก็ได้ ขอแค่เป็น `postgresql://...` มาตรฐาน + SSL

## 4) ใส่ Environment Variables

Vercel → **Settings → Environment Variables** เพิ่ม:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | (Neon ใส่ให้แล้ว — ตรวจว่าเป็น pooled + sslmode=require) |
| `AUTH_SECRET` | `ERUkKl1Q+6maZ/XuM+i2CnS9dHesZwH07F4Pu8rFISQ=` |
| `AUTH_TRUST_HOST` | `true` |

## 5) Deploy + นำข้อมูลขึ้น cloud

- กด **Deploy** — ตอน build จะรัน `prisma migrate deploy` สร้างตารางให้อัตโนมัติ
- หลัง deploy สำเร็จ ให้ **นำข้อมูลปัจจุบันขึ้น cloud** (ลูกค้า/ออเดอร์/สินค้าที่เทสไว้ + admin/admin)
  โดยรันจากเครื่อง **ครั้งเดียว** (ใช้ไฟล์ `prisma/seed-data.json` ที่ export ไว้แล้ว):

```bash
# แทน <CLOUD_URL> ด้วย DATABASE_URL ของ Neon (ก็อปจาก Vercel — ใช้แบบ pooled)
cd C:\Users\SuppakornJame\petcare-app
$env:DATABASE_URL="<CLOUD_URL>"; npm run db:import
```

> อยากได้ข้อมูลล่าสุดก่อน import? รัน `npm run db:export` ก่อน (ต้องเปิด `npm run db` อยู่)
> อยากได้แค่ข้อมูลตัวอย่างเปล่าๆ แทนข้อมูลจริง? ใช้ `npm run db:seed` แทน `db:import`

เสร็จแล้วเข้าเว็บที่ Vercel ให้มา → login **admin / admin** ได้เลย 🎉

---

## หมายเหตุ
- ทุกครั้งที่ push โค้ดใหม่ Vercel จะ build + migrate ให้อัตโนมัติ
- ถ้า build fail ที่ `migrate deploy` (เช่น DB ยังไม่พร้อม) ให้ตรวจ `DATABASE_URL` ใน env
- QR PromptPay ใช้ได้จริง — อย่าลืมตั้งบัญชี PromptPay หลักในเมนู Setting → บัญชีธนาคาร (สิทธิ์ Admin)
- นี่เป็น demo: หน้า verify การชำระเงินใช้แอดมินกดยืนยันเอง (ยังไม่ได้ตรวจสลิปอัตโนมัติ)
