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
