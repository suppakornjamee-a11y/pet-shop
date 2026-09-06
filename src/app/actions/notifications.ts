"use server";

import { prisma } from "@/lib/prisma";
import { requireStaffUser } from "@/lib/auth-helpers";

export type PendingApprovalItem = {
  id: string;
  code: string;
  customerName: string;
  petName: string | null;
  appointmentAt: string | null;
  checkInAt: string | null;
  createdAt: string;
};

/**
 * คิวที่ลูกค้าจองผ่าน LINE แล้วรอพนักงานยืนยัน — กระดิ่งแจ้งเตือนมุมขวาบนเรียกซ้ำเป็นระยะ
 *
 * ใช้วิธีถามเป็นรอบ (polling) ไม่ใช่ push จริง เพราะระบบ deploy บน Vercel แบบ serverless
 * ซึ่งเปิด connection ค้างไว้ (WebSocket/SSE) ไม่ได้ ถ้าจะ push จริงต้องเช่าบริการข้างนอกซึ่งมีค่าใช้จ่าย
 * — คิวใหม่ช้าได้ไม่กี่สิบวินาที จึงไม่คุ้มที่จะแลก
 */
export async function getPendingApprovals(): Promise<{
  count: number;
  items: PendingApprovalItem[];
}> {
  const user = await requireStaffUser();
  // ช่างอาบน้ำยืนยันคิวไม่ได้อยู่แล้ว ไม่ต้องรบกวนด้วยตัวเลขที่กดอะไรไม่ได้
  if (user.role === "GROOMER") return { count: 0, items: [] };

  const [count, orders] = await Promise.all([
    prisma.order.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.order.findMany({
      where: { status: "PENDING_APPROVAL" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        code: true,
        createdAt: true,
        appointmentAt: true,
        checkInAt: true,
        customer: { select: { name: true } },
        pet: { select: { name: true } },
      },
    }),
  ]);

  return {
    count,
    items: orders.map((o) => ({
      id: o.id,
      code: o.code,
      customerName: o.customer?.name ?? "",
      petName: o.pet?.name ?? null,
      appointmentAt: o.appointmentAt?.toISOString() ?? null,
      checkInAt: o.checkInAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
    })),
  };
}
