import { ImageResponse } from "next/og";

// ภาพพื้นหลัง Rich Menu ของ LINE OA — เข้าดูตรงๆ ที่ /api/richmenu/image เพื่อพรีวิวได้ทุกเมื่อ
// สร้างเป็นโค้ด (ไม่ใช่ไฟล์รูปนิ่ง) เพื่อแก้ข้อความ/สีตรงนี้แล้วเห็นผลทันทีตอนอัปโหลดรอบต่อไป
// ต้องใช้ฟอนต์ "Prompt" (ตัวเดียวกับที่ทั้งแอปใช้ ดู src/app/layout.tsx) เพราะ satori ไม่มีฟอนต์ไทยติดตั้งมาให้เอง

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

function MenuButton({ color, icon, label }: { color: string; icon: string; label: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 30,
        padding: "0 30px",
      }}
    >
      <div
        style={{
          display: "flex",
          width: 360,
          height: 360,
          borderRadius: 999,
          background: color,
          alignItems: "center",
          justifyContent: "center",
          fontSize: 200,
        }}
      >
        {icon}
      </div>
      <div style={{ display: "flex", fontSize: 62, fontWeight: 700, color, whiteSpace: "nowrap" }}>{label}</div>
    </div>
  );
}

export async function GET() {
  try {
    const fontData = await loadPromptFont(700, LABEL_BOOK + LABEL_ORDERS + LABEL_PROFILE);
    const divider = (
      <div style={{ display: "flex", width: 2, height: "62%", alignSelf: "center", background: "#e7e1d6" }} />
    );

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            background: "#fdfbf6",
            fontFamily: "Prompt",
          }}
        >
          <MenuButton color={BRAND_GREEN} icon="🐾" label={LABEL_BOOK} />
          {divider}
          <MenuButton color={BRAND_PINK} icon="📋" label={LABEL_ORDERS} />
          {divider}
          <MenuButton color={BRAND_GOLD} icon="👤" label={LABEL_PROFILE} />
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
