import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // โปรเจกต์อยู่ในโฟลเดอร์ home — กำหนด root ให้ชัดเพื่อไม่ให้ Turbopack ไปอ่าน lockfile นอกโปรเจกต์
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
