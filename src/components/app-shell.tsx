"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Menu } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import type { Dictionary } from "@/i18n/dictionaries/th";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import {
  CustomersImageIcon,
  ClipboardFlatIcon,
  StockImageIcon,
  CalendarFlatIcon,
  DashboardImageIcon,
  HolidayImageIcon,
  BankAccountsImageIcon,
  BoardingImageIcon,
  ShopImageIcon,
  RegisterImageIcon,
  BathCalendarImageIcon,
  OrdersImageIcon,
  UserAvatarFlatIcon,
  DashboardFlatIcon,
  RoomsImageIcon,
  LogoutImageIcon,
  ShopInfoImageIcon,
} from "@/components/nav-icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfileDialog } from "@/components/profile-dialog";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  hiddenForGroomer?: boolean;
};

type NavGroup = {
  title?: string;
  items: NavItem[];
};

function getNavGroups(t: Dictionary): NavGroup[] {
  return [
    {
      title: t.nav.mainGroup,
      items: [
        { href: "/", label: t.nav.dashboard, icon: DashboardImageIcon, hiddenForGroomer: true },
        { href: "/register", label: t.nav.register, icon: RegisterImageIcon, hiddenForGroomer: true },
        { href: "/calendar", label: t.nav.queueCalendar, icon: BathCalendarImageIcon },
        { href: "/orders/bath", label: t.nav.ordersBath, icon: OrdersImageIcon },
        { href: "/calendar-other", label: t.nav.otherServiceCalendar, icon: CalendarFlatIcon },
        { href: "/orders/other", label: t.nav.ordersOther, icon: OrdersImageIcon },
        { href: "/boarding", label: t.nav.boardingCalendar, icon: BoardingImageIcon, hiddenForGroomer: true },
        { href: "/customers", label: t.nav.customers, icon: CustomersImageIcon, hiddenForGroomer: true },
        { href: "/shop", label: t.nav.shopCafe, icon: ShopImageIcon, hiddenForGroomer: true },
        { href: "/reports", label: t.nav.reports, icon: DashboardFlatIcon, adminOnly: true },
      ],
    },
    {
      title: t.nav.settingsGroup,
      items: [
        { href: "/settings/stock", label: t.nav.stock, icon: StockImageIcon, hiddenForGroomer: true },
        { href: "/settings/rooms", label: t.nav.rooms, icon: RoomsImageIcon, hiddenForGroomer: true },
        { href: "/settings/services", label: t.nav.services, icon: ClipboardFlatIcon, hiddenForGroomer: true },
        { href: "/settings/bank-accounts", label: t.nav.bankAccounts, icon: BankAccountsImageIcon, adminOnly: true },
        { href: "/settings/users", label: t.nav.users, icon: UserAvatarFlatIcon, adminOnly: true },
        { href: "/settings/holidays", label: t.nav.holidays, icon: HolidayImageIcon, adminOnly: true },
        { href: "/settings/shop-info", label: t.nav.shopInfo, icon: ShopInfoImageIcon, adminOnly: true },
      ],
    },
  ];
}

type User = {
  name: string;
  username: string;
  role: Role;
  email: string;
  avatarUrl: string | null;
};

function roleLabel(t: Dictionary, role: Role) {
  return role === "ADMIN" ? t.nav.admin : role === "GROOMER" ? t.nav.groomer : t.nav.staff;
}

/** โปรไฟล์ผู้ใช้ที่ล็อกอินอยู่ — กดเพื่อแก้ไขชื่อ/อีเมล/รูป/รหัสผ่านของตัวเอง */
function TopbarProfile({ user }: { user: User }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t.profile.title}
        className="flex items-center gap-2.5 rounded-full py-1 pr-3 pl-1 transition-colors hover:bg-accent/70"
      >
        <Avatar className="h-9 w-9">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
          <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
            {user.name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="hidden text-left leading-tight sm:block">
          <div className="truncate text-sm font-medium">{user.name}</div>
          <div className="truncate text-xs text-muted-foreground">{roleLabel(t, user.role)}</div>
        </div>
      </button>

      <ProfileDialog
        open={open}
        onOpenChange={setOpen}
        profile={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }}
      />
    </>
  );
}

function SidebarContent({
  user,
  pathname,
  onNavigate,
}: {
  user: User;
  pathname: string;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  const navGroups = getNavGroups(t);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo.png" alt={t.nav.brand} className="block h-auto w-full object-cover" />
      </div>

      <nav className="flex-1 space-y-7 overflow-y-auto px-3.5 py-5">
        {navGroups.map((group, gi) => {
          const items = group.items.filter(
            (it) =>
              (!it.adminOnly || user.role === "ADMIN") &&
              (!it.hiddenForGroomer || user.role !== "GROOMER")
          );
          if (items.length === 0) return null;
          return (
            <div key={gi}>
              {group.title && (
                <div className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </div>
              )}
              <ul className="space-y-1.5">
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
                          "flex items-center gap-3.5 rounded-full px-3.5 py-2.5 text-[15px] transition-colors",
                          active
                            ? "bg-primary/10 font-semibold text-primary"
                            : "font-medium text-foreground/65 hover:bg-accent/70 hover:text-foreground"
                        )}
                      >
                        <Icon className="h-6 w-6 shrink-0" />
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

      {/* ออกจากระบบ — อยู่ท้าย sidebar ใช้ทรงเดียวกับเมนูด้านบนให้กลืนเป็นชุดเดียวกัน */}
      <div className="border-t p-3.5">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3.5 rounded-full px-3.5 py-2.5 text-[15px] font-medium text-foreground/65 transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogoutImageIcon className="h-6 w-6 shrink-0" />
          {t.nav.logout}
        </button>
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
  const { t } = useI18n();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 border-r bg-card lg:block">
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
              <SheetTitle className="sr-only">{t.nav.brand}</SheetTitle>
              <SidebarContent
                user={user}
                pathname={pathname}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          <div className="flex-1" />

          <LanguageToggle />
          <ThemeToggle />

          <div className="ml-1 h-8 w-px bg-border" />
          <TopbarProfile user={user} />
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
