import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // โปรเจกต์อยู่ในโฟลเดอร์ home — กำหนด root ให้ชัดเพื่อไม่ให้ Turbopack ไปอ่าน lockfile นอกโปรเจกต์
  turbopack: {
    root: path.resolve(__dirname),
  },
  // คำขอจองจาก LINE แนบภาพตัวอย่างทรงขนได้หลายรูปต่อรายการ — ค่าเริ่มต้น 1MB ไม่พอ (Vercel รับได้ถึง 4.5MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
