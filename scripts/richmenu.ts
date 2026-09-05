/**
 * ติดตั้ง Rich Menu 2 ชั้นให้ LINE OA — รันด้วย `npm run richmenu`
 *
 *   เมนูหลัก (petcare-main) ─ กดช่อง "บริการของเรา" ─> เมนูย่อย (petcare-services)
 *                                                       ├─ ลงทะเบียนลูกค้าใหม่ → /liff/register
 *                                                       ├─ จองคิว             → /liff/book
 *                                                       ├─ ประวัติการจอง       → /liff/orders
 *                                                       ├─ โปรไฟล์ของฉัน       → /liff/profile
 *                                                       └─ กลับเมนูหลัก        → สลับกลับ
 *
 * การสลับเมนูใช้ action แบบ richmenuswitch ซึ่งอ้างถึงกันด้วย "alias" (ไม่ใช่ rich menu id ตรงๆ)
 * ทำให้อัปเดตรูป/เลย์เอาต์ใหม่ได้โดยไม่ต้องแก้เมนูอีกฝั่ง — ต้องใช้แอป LINE เวอร์ชัน 10.13.0 ขึ้นไป
 *
 * รูปพื้นหลังดึงจาก /api/richmenu/image ของเซิร์ฟเวอร์ที่รันอยู่ (เปลี่ยน base ได้ที่ RICHMENU_IMAGE_BASE)
 * พิกัดปุ่ม (areas) ด้านล่างต้องตรงกับเลย์เอาต์ใน src/app/api/richmenu/image/route.tsx เสมอ
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const API = "https://api.line.me/v2/bot";
const API_DATA = "https://api-data.line.me/v2/bot";

const MAIN_ALIAS = "petcare-main";
const SERVICES_ALIAS = "petcare-services";

/* ---------- โหลดค่าจาก .env เอง (สคริปต์นี้ไม่ได้รันผ่าน Next จึงไม่มีตัวโหลดให้) ---------- */
function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    const full = path.join(process.cwd(), file);
    if (!existsSync(full)) continue;
    for (const rawLine of readFileSync(full, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(rawLine);
      if (!m) continue;
      const value = m[2].trim().replace(/^["']|["']$/g, "");
      if (value) process.env[m[1]] = value;
    }
  }
}
loadEnv();

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LIFF_ID = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
const IMAGE_BASE = process.env.RICHMENU_IMAGE_BASE ?? "http://localhost:3000";

if (!TOKEN) throw new Error("ไม่พบ LINE_CHANNEL_ACCESS_TOKEN ใน .env");
if (!LIFF_ID) throw new Error("ไม่พบ NEXT_PUBLIC_LINE_LIFF_ID ใน .env");

const liff = (p: string) => `https://liff.line.me/${LIFF_ID}${p}`;

/* ---------- helper เรียก LINE API ---------- */
async function line<T = unknown>(
  method: string,
  url: string,
  init: { json?: unknown; body?: BodyInit; contentType?: string } = {}
): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${TOKEN}` };
  let body: BodyInit | undefined = init.body;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  } else if (init.contentType) {
    headers["Content-Type"] = init.contentType;
  }
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${text}`);
  return (text ? JSON.parse(text) : {}) as T;
}

/* ---------- พิกัดปุ่ม ---------- */
const SIZE = { width: 2500, height: 1686 };
const COL_X = [0, 833, 1666];
const COL_W = [833, 833, 834]; // คอลัมน์สุดท้ายกว้างกว่า 1px ให้ครบ 2500 พอดี

/** เมนูหลัก — ตาราง 3 คอลัมน์ x 2 แถว ช่องละ 833 x 843 */
const mainMenu = {
  size: SIZE,
  selected: true,
  name: "PetCare - เมนูหลัก",
  chatBarText: "เมนู",
  areas: [
    {
      bounds: { x: COL_X[0], y: 0, width: COL_W[0], height: 843 },
      action: { type: "richmenuswitch", richMenuAliasId: SERVICES_ALIAS, data: "menu=services" },
    },
    {
      bounds: { x: COL_X[1], y: 0, width: COL_W[1], height: 843 },
      action: { type: "message", text: "อาบน้ำ ตัดขน" },
    },
    {
      bounds: { x: COL_X[2], y: 0, width: COL_W[2], height: 843 },
      action: { type: "message", text: "โรงแรมสัตว์เลี้ยง" },
    },
    {
      bounds: { x: COL_X[0], y: 843, width: COL_W[0], height: 843 },
      action: { type: "message", text: "โปรโมชั่น" },
    },
    {
      bounds: { x: COL_X[1], y: 843, width: COL_W[1], height: 843 },
      action: { type: "message", text: "แผนที่ร้าน" },
    },
    {
      bounds: { x: COL_X[2], y: 843, width: COL_W[2], height: 843 },
      action: { type: "message", text: "ติดต่อแอดมิน" },
    },
  ],
};

/** เมนูย่อย — แบนเนอร์ 470 / ปุ่ม 3 อัน 860 / แถบย้อนกลับ 356 */
const servicesMenu = {
  size: SIZE,
  selected: false,
  name: "PetCare - บริการของเรา",
  chatBarText: "บริการของเรา",
  areas: [
    {
      bounds: { x: 0, y: 0, width: 2500, height: 470 },
      action: { type: "uri", label: "ลงทะเบียน", uri: liff("/register") },
    },
    {
      bounds: { x: COL_X[0], y: 470, width: COL_W[0], height: 860 },
      action: { type: "uri", label: "จองคิว", uri: liff("/book") },
    },
    {
      bounds: { x: COL_X[1], y: 470, width: COL_W[1], height: 860 },
      action: { type: "uri", label: "ประวัติการจอง", uri: liff("/orders") },
    },
    {
      bounds: { x: COL_X[2], y: 470, width: COL_W[2], height: 860 },
      action: { type: "uri", label: "โปรไฟล์", uri: liff("/profile") },
    },
    {
      bounds: { x: 0, y: 1330, width: 2500, height: 356 },
      action: { type: "richmenuswitch", richMenuAliasId: MAIN_ALIAS, data: "menu=main" },
    },
  ],
};

/* ---------- ขั้นตอนติดตั้ง ---------- */
async function fetchImage(menu: "main" | "services") {
  const url = `${IMAGE_BASE}/api/richmenu/image?menu=${menu}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ดึงรูป ${url} ไม่สำเร็จ (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 1024 * 1024) throw new Error(`รูป ${menu} ใหญ่เกิน 1MB (${buf.length} bytes)`);
  return buf;
}

async function wipeExisting() {
  const aliases = await line<{ aliases?: { richMenuAliasId: string }[] }>(
    "GET",
    `${API}/richmenu/alias/list`
  );
  for (const a of aliases.aliases ?? []) {
    await line("DELETE", `${API}/richmenu/alias/${a.richMenuAliasId}`);
    console.log(`  ลบ alias เดิม: ${a.richMenuAliasId}`);
  }
  const menus = await line<{ richmenus?: { richMenuId: string }[] }>("GET", `${API}/richmenu/list`);
  for (const m of menus.richmenus ?? []) {
    await line("DELETE", `${API}/richmenu/${m.richMenuId}`);
    console.log(`  ลบ rich menu เดิม: ${m.richMenuId}`);
  }
}

async function createMenu(def: object, image: Buffer, label: string) {
  const { richMenuId } = await line<{ richMenuId: string }>("POST", `${API}/richmenu`, {
    json: def,
  });
  await line("POST", `${API_DATA}/richmenu/${richMenuId}/content`, {
    body: new Uint8Array(image),
    contentType: "image/png",
  });
  console.log(`  สร้าง ${label}: ${richMenuId}`);
  return richMenuId;
}

async function main() {
  const info = await line<{ displayName: string; basicId: string }>("GET", `${API}/info`);
  console.log(`OA: ${info.displayName} (${info.basicId})`);
  console.log(`LIFF: ${liff("/<page>")}`);
  console.log(`รูป: ${IMAGE_BASE}/api/richmenu/image`);

  console.log("\n1) ดึงรูปเมนู");
  const [mainImage, servicesImage] = await Promise.all([
    fetchImage("main"),
    fetchImage("services"),
  ]);
  console.log(`  main ${mainImage.length} bytes / services ${servicesImage.length} bytes`);

  console.log("\n2) ล้างเมนูเดิม");
  await wipeExisting();

  console.log("\n3) สร้างเมนูใหม่");
  const servicesId = await createMenu(servicesMenu, servicesImage, "เมนูย่อย");
  const mainId = await createMenu(mainMenu, mainImage, "เมนูหลัก");

  console.log("\n4) ผูก alias");
  await line("POST", `${API}/richmenu/alias`, {
    json: { richMenuAliasId: SERVICES_ALIAS, richMenuId: servicesId },
  });
  await line("POST", `${API}/richmenu/alias`, {
    json: { richMenuAliasId: MAIN_ALIAS, richMenuId: mainId },
  });
  console.log(`  ${MAIN_ALIAS} -> ${mainId}`);
  console.log(`  ${SERVICES_ALIAS} -> ${servicesId}`);

  console.log("\n5) ตั้งเมนูหลักเป็นค่าเริ่มต้นของทุกคน");
  await line("POST", `${API}/user/all/richmenu/${mainId}`);

  console.log("\nเสร็จแล้ว — ปิดแล้วเปิดห้องแชทใหม่เพื่อดูเมนู");
}

main().catch((e) => {
  console.error("\nล้มเหลว:", e instanceof Error ? e.message : e);
  process.exit(1);
});
