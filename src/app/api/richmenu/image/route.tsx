import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

// ภาพพื้นหลัง Rich Menu ของ LINE OA — เข้าดูตรงๆ เพื่อพรีวิวได้ทุกเมื่อ
//   /api/richmenu/image?menu=main      → เมนูหลัก 6 ช่อง (ช่อง "บริการของเรา" จะสลับไปเมนูย่อย)
//   /api/richmenu/image?menu=services  → เมนูย่อย ลิงก์เข้าหน้า LIFF ของระบบเรา + ปุ่มย้อนกลับ
//
// สร้างเป็นโค้ด (ไม่ใช่ไฟล์รูปนิ่ง) เพื่อแก้เลย์เอาต์/สีตรงนี้แล้วเห็นผลทันทีตอนอัปโหลดรอบต่อไป
// พิกัดปุ่ม (areas) ที่ส่งให้ LINE อยู่ใน scripts/richmenu.ts — ถ้าแก้เลย์เอาต์ตรงนี้ต้องแก้ที่นั่นด้วย
//
// รูปปุ่ม 3 อันในเมนูย่อยเป็นรูปที่ผู้ใช้ทำมาเอง (src/assets/richmenu/btn-*.png) โดยในรูป "มีทั้ง
// ไอคอนและข้อความกำกับอยู่แล้ว" จึงไม่วาดข้อความซ้อนทับอีก และพื้นหลังรูปเป็นสีขาวสนิทซึ่งกลืน
// กับการ์ดสีขาวพอดี (ไม่ต้องตัดพื้นหลัง — วิธีตัดพื้นหลังเคยลองแล้วมันกินเนื้อไอคอนไปด้วย)

export const runtime = "nodejs";

/* ---------- ขนาดมาตรฐาน Rich Menu แบบเต็ม ---------- */
const W = 2500;
const H = 1686;

/* ---------- โทนสี (อิงโทนครีม-เขียวเดิมของเมนูชุดแรก) ---------- */
const CREAM = "#fdfbf6";
const CARD = "#ffffff";
const INK = "#12463b";
const MUTED = "#6e8b82";
const PINK_BG = "#fce9ef";
const PILL_BG = "#0e4034";
const SHADOW = "0 24px 50px rgba(15,61,51,0.14)";

// เขียนพาธแบบมีโฟลเดอร์เป็นข้อความตรงๆ ทุกครั้ง (ห้ามส่งพาธมาทั้งก้อนเป็นตัวแปร) เพราะตัวไล่หา
// ไฟล์แนบของ Next จะอ่านพาธไม่ออกแล้วเหมาเอาทั้งโปรเจกต์ไปแนบตอน build — ขึ้น warning
// "Dynamic filesystem access causes tracing of the whole project" และทำให้ bundle บวมโดยใช่เหตุ
const toDataUri = (buf: Buffer) => `data:image/png;base64,${buf.toString("base64")}`;

const icon = async (name: string) =>
  toDataUri(await readFile(path.join(process.cwd(), "public", "images", "icons", name)));

const button = async (name: string) =>
  toDataUri(await readFile(path.join(process.cwd(), "src", "assets", "richmenu", name)));

async function loadFonts() {
  const [regular, semibold] = await Promise.all([
    readFile(path.join(process.cwd(), "src", "assets", "fonts", "Kanit-Regular.ttf")),
    readFile(path.join(process.cwd(), "src", "assets", "fonts", "Kanit-SemiBold.ttf")),
  ]);
  return [
    { name: "Kanit", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Kanit", data: semibold, weight: 600 as const, style: "normal" as const },
  ];
}

/* ================= เมนูหลัก ================= */

/** ช่องหนึ่งช่องในตาราง 3x2 — ขอบเขตช่องเท่ากับพิกัดที่กดได้พอดี (833 x 843) */
function Tile({
  iconSrc,
  label,
  featured = false,
  hint,
}: {
  iconSrc: string;
  label: string;
  featured?: boolean;
  hint?: string;
}) {
  return (
    <div style={{ display: "flex", flex: 1, padding: 30 }}>
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          background: featured ? PINK_BG : CARD,
          borderRadius: 52,
          boxShadow: SHADOW,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconSrc} width={216} height={216} alt="" />
        <div style={{ fontSize: 74, fontWeight: 600, color: INK }}>{label}</div>
        {hint ? (
          <div
            style={{
              display: "flex",
              marginTop: 4,
              padding: "10px 34px",
              borderRadius: 999,
              background: PILL_BG,
              color: CREAM,
              fontSize: 42,
            }}
          >
            {hint}
          </div>
        ) : null}
      </div>
    </div>
  );
}

async function MainMenu() {
  const [dog, grooming, boarding, holiday, shop, cat] = await Promise.all([
    icon("dog.png"),
    icon("grooming-queue.png"),
    icon("boarding.png"),
    icon("holiday.png"),
    icon("shop.png"),
    icon("cat.png"),
  ]);

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", flexDirection: "column", background: CREAM }}>
      <div style={{ display: "flex", flex: 1 }}>
        <Tile iconSrc={dog} label="บริการของเรา" featured hint="แตะเพื่อเลือก" />
        <Tile iconSrc={grooming} label="อาบน้ำ ตัดขน" />
        <Tile iconSrc={boarding} label="โรงแรมสัตว์เลี้ยง" />
      </div>
      <div style={{ display: "flex", flex: 1 }}>
        <Tile iconSrc={holiday} label="โปรโมชั่น" />
        <Tile iconSrc={shop} label="แผนที่ร้าน" />
        <Tile iconSrc={cat} label="ติดต่อแอดมิน" />
      </div>
    </div>
  );
}

/* ================= เมนูย่อย (บริการของเรา) ================= */

const BTN_W = 620; // อัตราส่วนรูปต้นฉบับ ~505x322 → คงสัดส่วนไว้
const BTN_H = 395;

function ButtonCard({ src }: { src: string }) {
  return (
    <div style={{ display: "flex", flex: 1, padding: 26 }}>
      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          background: CARD,
          borderRadius: 52,
          boxShadow: SHADOW,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={BTN_W} height={BTN_H} alt="" />
      </div>
    </div>
  );
}

async function ServicesMenu() {
  const [register, book, orders, profile] = await Promise.all([
    icon("register.png"),
    button("btn-book.png"),
    button("btn-orders.png"),
    button("btn-profile.png"),
  ]);

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", flexDirection: "column", background: CREAM }}>
      {/* แบนเนอร์ลงทะเบียน — สูง 470 */}
      <div style={{ display: "flex", height: 470, padding: 36 }}>
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            gap: 48,
            padding: "0 72px",
            background: PINK_BG,
            borderRadius: 52,
            boxShadow: SHADOW,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={register} width={220} height={220} alt="" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 88, fontWeight: 600, color: INK }}>ลงทะเบียนลูกค้าใหม่</div>
            <div style={{ fontSize: 48, color: MUTED }}>สำหรับลูกค้าที่ยังไม่เคยใช้บริการ</div>
          </div>
        </div>
      </div>

      {/* ปุ่ม 3 อัน — สูง 860 */}
      <div style={{ display: "flex", height: 860, padding: "0 10px" }}>
        <ButtonCard src={book} />
        <ButtonCard src={orders} />
        <ButtonCard src={profile} />
      </div>

      {/* แถบย้อนกลับ — สูง 356 */}
      <div style={{ display: "flex", flex: 1, padding: 36 }}>
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            background: PILL_BG,
            borderRadius: 52,
            color: CREAM,
            fontSize: 64,
            fontWeight: 600,
          }}
        >
          ‹ กลับเมนูหลัก
        </div>
      </div>
    </div>
  );
}

/* ================= route ================= */

export async function GET(request: Request) {
  const menu = new URL(request.url).searchParams.get("menu") ?? "services";
  try {
    const fonts = await loadFonts();
    const element = menu === "main" ? await MainMenu() : await ServicesMenu();
    return new ImageResponse(element, { width: W, height: H, fonts });
  } catch (e) {
    console.error("[richmenu/image] generation failed:", e);
    return new Response("Failed to generate rich menu image", { status: 500 });
  }
}
