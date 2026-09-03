import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

// ภาพพื้นหลัง Rich Menu ของ LINE OA — เข้าดูตรงๆ ที่ /api/richmenu/image เพื่อพรีวิวได้ทุกเมื่อ
// สร้างเป็นโค้ด (ไม่ใช่ไฟล์รูปนิ่ง) เพื่อแก้ข้อความ/สีตรงนี้แล้วเห็นผลทันทีตอนอัปโหลดรอบต่อไป
// ต้องใช้ฟอนต์ "Prompt" (ตัวเดียวกับที่ทั้งแอปใช้ ดู src/app/layout.tsx) เพราะ satori ไม่มีฟอนต์ไทยติดตั้งมาให้เอง
// ไอคอนเป็นรูปที่ผู้ใช้ครอปมาจากเทมเพลตตัวอย่าง (src/assets/richmenu/icon-*-clean.png) — รูปครอปดิบมี
// พื้นหลังทึบติดมา จึงตัดพื้นหลังออกด้วยสคริปต์ flood-fill ก่อนเก็บเป็นไฟล์ "-clean" (มี alpha transparency)

const BRAND_GREEN = "#0f3d33";
const BRAND_PINK = "#ec4899";
const BRAND_GOLD = "#c9973f";
const LABEL_BOOK = "จองบริการ";
const LABEL_ORDERS = "การจองของฉัน";
const LABEL_PROFILE = "โปรไฟล์ของฉัน";

async function loadPromptFont(weight: number, text: string): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=Prompt:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await fetch(cssUrl).then((r) => r.text());
  const match = css.match(/src: url\(([^)]+)\) format\('(?:opentype|truetype)'\)/);
  if (!match) throw new Error("ไม่พบไฟล์ฟอนต์ Prompt จาก Google Fonts");
  const res = await fetch(match[1]);
  return res.arrayBuffer();
}

async function loadIconDataUri(filename: string): Promise<string> {
  const filePath = path.join(process.cwd(), "src", "assets", "richmenu", filename);
  const buf = await readFile(filePath);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

function MenuCard({ color, iconSrc, label }: { color: string; iconSrc: string; label: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        background: "#ffffff",
        borderRadius: 56,
        boxShadow: "0 24px 50px rgba(15,61,51,0.14)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={iconSrc} width={230} height={230} alt="" />
      <div style={{ display: "flex", fontSize: 54, fontWeight: 700, color, whiteSpace: "nowrap" }}>{label}</div>
    </div>
  );
}

export async function GET() {
  try {
    const [fontData, calendarIcon, notepadIcon, chatIcon] = await Promise.all([
      loadPromptFont(700, LABEL_BOOK + LABEL_ORDERS + LABEL_PROFILE),
      loadIconDataUri("icon-calendar-clean.png"),
      loadIconDataUri("icon-notepad-clean.png"),
      loadIconDataUri("icon-chat-clean.png"),
    ]);

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            background: "#fdfbf6",
            fontFamily: "Prompt",
            padding: "45px",
            gap: 40,
          }}
        >
          <MenuCard color={BRAND_GREEN} iconSrc={calendarIcon} label={LABEL_BOOK} />
          <MenuCard color={BRAND_PINK} iconSrc={notepadIcon} label={LABEL_ORDERS} />
          <MenuCard color={BRAND_GOLD} iconSrc={chatIcon} label={LABEL_PROFILE} />
        </div>
      ),
      {
        width: 2500,
        height: 843,
        fonts: [{ name: "Prompt", data: fontData, weight: 700, style: "normal" }],
      }
    );
  } catch (e) {
    console.error("[richmenu/image] generation failed:", e);
    return new Response("Failed to generate rich menu image", { status: 500 });
  }
}
