/** อ่านไฟล์รูปเป็น data URL (เก็บลง DB ตรงๆ — ยังไม่มีระบบ cloud storage) */
export function fileToDataUrl(file: File, maxBytes = 3 * 1024 * 1024): Promise<string> {
  if (file.size > maxBytes) {
    return Promise.reject(new Error(`ไฟล์ใหญ่เกินไป (สูงสุด ${Math.round(maxBytes / 1024 / 1024)}MB)`));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

/**
 * ย่อรูปก่อนแปลงเป็น data URL — จำเป็น ไม่ใช่แค่ประหยัดพื้นที่
 *
 * server action ของ Next รับ body ได้ 1MB โดยค่าเริ่มต้น แต่รูปจากกล้องมือถือใบเดียวก็ 3-5MB
 * แล้ว base64 ยังบวกอีก 33% — ส่งไปตรงๆ จะถูกปฏิเสธตั้งแต่ยังไม่ถึงโค้ดเรา กลายเป็นกดแล้วเงียบ
 * ย่อเหลือด้านยาว 1280px + JPEG 0.8 จะได้ราว 150-400KB ซึ่งยังอ่านตัวเลขบนสลิปออกสบาย
 *
 * ถ้าเบราว์เซอร์ไหนวาด canvas ไม่ได้ จะถอยไปใช้ไฟล์เดิม (ดีกว่าค้างไปเลย)
 */
export async function compressImageToDataUrl(
  file: File,
  { maxSide = 1280, quality = 0.8, maxBytes = 8 * 1024 * 1024 } = {}
): Promise<string> {
  if (file.size > maxBytes) {
    throw new Error(`ไฟล์ใหญ่เกินไป (สูงสุด ${Math.round(maxBytes / 1024 / 1024)}MB)`);
  }

  const original = await fileToDataUrl(file, maxBytes);
  if (!file.type.startsWith("image/")) return original;

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("เปิดรูปไม่สำเร็จ"));
      el.src = original;
    });

    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    // รูปเล็กอยู่แล้วและไฟล์ไม่ใหญ่ ก็ส่งของเดิมไป ไม่ต้องบีบซ้ำให้เสียคุณภาพฟรีๆ
    if (scale === 1 && original.length < 700_000) return original;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const out = canvas.toDataURL("image/jpeg", quality);
    return out.length < original.length ? out : original;
  } catch {
    return original;
  }
}
