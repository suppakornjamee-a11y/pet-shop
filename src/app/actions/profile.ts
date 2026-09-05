"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import type { ActionResult } from "./customers";

const schema = z
  .object({
    name: z.string().trim().min(1, "กรุณากรอกชื่อ"),
    email: z.string().trim().email("อีเมลไม่ถูกต้อง").or(z.literal("")).optional(),
    avatarUrl: z.string().nullish(),
    // เว้นว่าง = ไม่เปลี่ยนรหัสผ่าน / พิมพ์มา = ตั้งรหัสใหม่ทับของเดิม
    password: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.password && v.password.length < 4) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "รหัสผ่านสั้นเกินไป" });
    }
  });

/**
 * แก้ไขโปรไฟล์ของตัวเอง — ชื่อ / อีเมล / รูปโปรไฟล์ / รหัสผ่าน
 *
 * ตั้งใจแยกจาก updateUser ในหน้าตั้งค่าผู้ใช้งาน (ซึ่งเป็นของผู้จัดการ) เพราะที่นี่แก้ได้เฉพาะ
 * บัญชีตัวเองเท่านั้น และห้ามแตะสิทธิ์/สถานะเปิด-ปิดบัญชีเด็ดขาด ไม่งั้นพนักงานจะเลื่อนขั้นตัวเองได้
 */
export async function updateMyProfile(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { name, email, avatarUrl, password } = parsed.data;

  const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;

  if (email) {
    const taken = await prisma.user.findFirst({
      where: { email, NOT: { id: user.id } },
      select: { id: true },
    });
    if (taken) return { ok: false, error: "อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      email: email || null,
      avatarUrl: avatarUrl || null,
      ...(passwordHash ? { passwordHash } : {}),
    },
  });

  revalidatePath("/");
  return { ok: true, message: "บันทึกโปรไฟล์เรียบร้อย" };
}
