import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

// ภาพพื้นหลัง Rich Menu ของ LINE OA — เข้าดูตรงๆ ที่ /api/richmenu/image เพื่อพรีวิวได้ทุกเมื่อ
// สร้างเป็นโค้ด (ไม่ใช่ไฟล์รูปนิ่ง) เพื่อแก้เลย์เอาต์/สีตรงนี้แล้วเห็นผลทันทีตอนอัปโหลดรอบต่อไป
//
// ปุ่มทั้ง 3 เป็นรูปที่ผู้ใช้ทำมาเอง (src/assets/richmenu/btn-*.png) โดยในรูป "มีทั้งไอคอนและข้อความ
// กำกับอยู่แล้ว" จึงไม่ต้องวาดข้อความซ้อนทับอีก และพื้นหลังรูปเป็นสีขาวสนิทซึ่งกลืนกับการ์ดสีขาวพอดี
// (ไม่ต้องตัดพื้นหลัง — วิธีตัดพื้นหลังเคยลองแล้วมันกินเนื้อไอคอนไปด้วย)

const BTN_W = 620; // อัตราส่วนรูปต้นฉบับ ~505x322 → คงสัดส่วนไว้
const BTN_H = 395;

async function loadIconDataUri(filename: string): Promise<string> {
  const filePath = path.join(process.cwd(), "src", "assets", "richmenu", filename);
  const buf = await readFile(filePath);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

function MenuCard({ src }: { src: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        borderRadius: 56,
        boxShadow: "0 24px 50px rgba(15,61,51,0.14)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} width={BTN_W} height={BTN_H} alt="" />
    </div>
  );
}

export async function GET() {
  try {
    const [bookIcon, ordersIcon, profileIcon] = await Promise.all([
      loadIconDataUri("btn-book.png"),
      loadIconDataUri("btn-orders.png"),
      loadIconDataUri("btn-profile.png"),
    ]);

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            background: "#fdfbf6",
            padding: "45px",
            gap: 40,
          }}
        >
          <MenuCard src={bookIcon} />
          <MenuCard src={ordersIcon} />
          <MenuCard src={profileIcon} />
        </div>
      ),
      { width: 2500, height: 843 }
    );
  } catch (e) {
    console.error("[richmenu/image] generation failed:", e);
    return new Response("Failed to generate rich menu image", { status: 500 });
  }
}
