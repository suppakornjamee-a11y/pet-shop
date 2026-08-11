"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  PawPrint,
  ClipboardPlus,
  Users,
  ReceiptText,
  Settings,
  Boxes,
  BedDouble,
  Landmark,
  UserCog,
  LogOut,
  Menu,
} from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

type NavGroup = {
  title?: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    items: [
      { href: "/", label: "แดชบอร์ด", icon: LayoutDashboard },
      { href: "/register", label: "ลงทะเบียนสัตว์เลี้ยง", icon: PawPrint },
      { href: "/orders/new", label: "สร้างออเดอร์", icon: ClipboardPlus },
      { href: "/orders", label: "ออเดอร์ทั้งหมด", icon: ReceiptText },
      { href: "/customers", label: "ประวัติลูกค้า", icon: Users },
    ],
  },
  {
    title: "ตั้งค่า (Setting)",
    items: [
      { href: "/settings/stock", label: "สินค้า / สต็อก", icon: Boxes },
      { href: "/settings/rooms", label: "ห้องพัก", icon: BedDouble },
      { href: "/settings/bank-accounts", label: "บัญชีธนาคาร", icon: Landmark, adminOnly: true },
      { href: "/settings/users", label: "ผู้ใช้งาน", icon: UserCog, adminOnly: true },
    ],
  },
];

type User = { name: string; username: string; role: Role };

function SidebarContent({
  user,
  pathname,
  onNavigate,
}: {
  user: User;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-lg">
          🐾
        </span>
        <div className="leading-tight">
          <div className="font-bold">PetCare</div>
          <div className="text-[11px] text-muted-foreground">ระบบจัดการร้าน</div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {navGroups.map((group, gi) => {
          const items = group.items.filter(
            (it) => !it.adminOnly || user.role === "ADMIN"
          );
          if (items.length === 0) return null;
          return (
            <div key={gi}>
              {group.title && (
                <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </div>
              )}
              <ul className="space-y-1">
                {items.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-foreground/70 hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {user.name.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <Badge variant="secondary" className="mt-0.5 h-4 px-1.5 text-[10px]">
              {user.role === "ADMIN" ? "แอดมิน" : "พนักงาน"}
            </Badge>
          </div>
        </div>
        <Button
          variant="outline"
          className="mt-2 w-full justify-start text-destructive hover:text-destructive"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut /> ออกจากระบบ
        </Button>
      </div>
    </div>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-card lg:block">
        <div className="sticky top-0 h-dvh">
          <SidebarContent user={user} pathname={pathname} />
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur lg:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={<Button variant="ghost" size="icon" className="lg:hidden" />}
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">เมนู</SheetTitle>
              <SidebarContent
                user={user}
                pathname={pathname}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          <div className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2 px-2" />}>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {user.name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline">{user.name}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <div className="font-medium">{user.name}</div>
                <div className="text-xs text-muted-foreground">
                  @{user.username} ·{" "}
                  {user.role === "ADMIN" ? "แอดมิน" : "พนักงาน"}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut />
                ออกจากระบบ
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
