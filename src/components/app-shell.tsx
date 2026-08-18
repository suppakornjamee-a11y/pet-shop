"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, Menu } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import type { Dictionary } from "@/i18n/dictionaries/th";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import {
  CustomerRecordFlatIcon,
  DocumentFlatIcon,
  ClipboardFlatIcon,
  StockFlatIcon,
  CalendarFlatIcon,
  CalendarDayFlatIcon,
  CalendarRangeFlatIcon,
  DashboardFlatIcon,
  UserAvatarFlatIcon,
  BankPaymentFlatIcon,
  BedFlatIcon,
} from "@/components/nav-icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
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

function getNavGroups(t: Dictionary): NavGroup[] {
  return [
    {
      items: [
        { href: "/", label: t.nav.dashboard, icon: DashboardFlatIcon },
        { href: "/register", label: t.nav.register, icon: ClipboardFlatIcon },
        { href: "/calendar", label: t.nav.queueCalendar, icon: CalendarDayFlatIcon },
        { href: "/orders/bath", label: t.nav.ordersBath, icon: DocumentFlatIcon },
        { href: "/calendar-other", label: t.nav.otherServiceCalendar, icon: CalendarFlatIcon },
        { href: "/orders/other", label: t.nav.ordersOther, icon: DocumentFlatIcon },
        { href: "/boarding", label: t.nav.boardingCalendar, icon: CalendarRangeFlatIcon },
        { href: "/customers", label: t.nav.customers, icon: CustomerRecordFlatIcon },
        { href: "/shop", label: t.nav.shopCafe, icon: StockFlatIcon },
      ],
    },
    {
      title: t.nav.settingsGroup,
      items: [
        { href: "/settings/stock", label: t.nav.stock, icon: StockFlatIcon },
        { href: "/settings/rooms", label: t.nav.rooms, icon: BedFlatIcon },
        { href: "/settings/services", label: t.nav.services, icon: ClipboardFlatIcon },
        { href: "/settings/bank-accounts", label: t.nav.bankAccounts, icon: BankPaymentFlatIcon, adminOnly: true },
        { href: "/settings/users", label: t.nav.users, icon: UserAvatarFlatIcon, adminOnly: true },
      ],
    },
  ];
}

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
  const { t } = useI18n();
  const navGroups = getNavGroups(t);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-18 items-center gap-3 border-b px-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-xl">
          🐾
        </span>
        <div className="leading-tight">
          <div className="text-lg font-bold tracking-tight">{t.nav.brand}</div>
          <div className="text-xs text-muted-foreground">{t.nav.brandSubtitle}</div>
        </div>
      </div>

      <nav className="flex-1 space-y-7 overflow-y-auto px-3.5 py-5">
        {navGroups.map((group, gi) => {
          const items = group.items.filter(
            (it) => !it.adminOnly || user.role === "ADMIN"
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
                          "flex items-center gap-3.5 rounded-lg px-3.5 py-2.5 text-[15px] transition-colors",
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

      <div className="border-t p-3.5">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary text-base font-semibold">
              {user.name.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[15px] font-medium">{user.name}</div>
            <Badge variant="secondary" className="mt-0.5 h-4 px-1.5 text-[10px]">
              {user.role === "ADMIN" ? t.nav.admin : t.nav.staff}
            </Badge>
          </div>
        </div>
        <Button
          variant="outline"
          className="mt-2.5 w-full justify-start text-destructive hover:text-destructive"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut /> {t.nav.logout}
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
                  {user.role === "ADMIN" ? t.nav.admin : t.nav.staff}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut />
                {t.nav.logout}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
