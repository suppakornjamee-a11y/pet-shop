import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

/**
 * สร้าง PromptPay payload (EMVCo) จากเบอร์/เลขบัตร + จำนวนเงิน
 */
export function buildPromptPayPayload(id: string, amount: number): string {
  const sanitized = id.replace(/[^0-9]/g, "");
  return generatePayload(sanitized, { amount });
}

/**
 * แปลง payload เป็น Data URL (PNG) สำหรับแสดงเป็น QR
 */
export async function payloadToDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}
