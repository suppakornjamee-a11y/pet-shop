"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });
      if (res?.error) {
        toast.error("เข้าสู่ระบบไม่สำเร็จ", {
          description: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
        });
        return;
      }
      toast.success("เข้าสู่ระบบสำเร็จ");
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <Card className="shadow-xl border-border/60">
      <CardHeader>
        <CardTitle className="text-xl">เข้าสู่ระบบ</CardTitle>
        <CardDescription>กรอกชื่อผู้ใช้และรหัสผ่านเพื่อเข้าใช้งาน</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">ชื่อผู้ใช้</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">รหัสผ่าน</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <LogIn />
            )}
            เข้าสู่ระบบ
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
