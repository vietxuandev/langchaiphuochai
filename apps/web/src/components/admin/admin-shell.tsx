'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  ChevronRight,
  ExternalLink,
  FileText,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Sun,
  UserCircle,
  Users,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { BRAND, ROLE_LABELS, Role } from '@phuochai/shared';
import { BrandLogo } from '@/components/site/brand-logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Vai trò tối thiểu để thấy mục này. */
  minRole: Role;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/quan-tri', label: 'Tổng quan', icon: LayoutDashboard, minRole: Role.USER, exact: true },
  { href: '/quan-tri/bai-viet', label: 'Bài viết', icon: FileText, minRole: Role.USER },
  { href: '/quan-tri/danh-muc', label: 'Danh mục', icon: FolderTree, minRole: Role.ADMIN },
  { href: '/quan-tri/nguoi-dung', label: 'Người dùng', icon: Users, minRole: Role.ADMIN },
  { href: '/quan-tri/tai-khoan', label: 'Tài khoản', icon: UserCircle, minRole: Role.USER },
];

/** Khung quản trị: kiểm tra đăng nhập, phân quyền menu, điều hướng. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, hasRole } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/dang-nhap?tiep-theo=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner label="Đang kiểm tra đăng nhập" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Đang chuyển tới trang đăng nhập...
      </div>
    );
  }

  const items = NAV_ITEMS.filter((item) => hasRole(item.minRole));

  const SidebarContent = (
    <nav className="space-y-1">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
              active
                ? 'bg-primary text-primary-foreground shadow-soft'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
            {active ? <ChevronRight className="ml-auto h-4 w-4" /> : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="flex">
        {/* Sidebar desktop */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-background p-4 lg:flex">
          <Link href="/" className="mb-6 flex items-center gap-2">
            <BrandLogo className="h-9 w-9" />
            <span>
              <span className="block font-display text-sm font-bold">{BRAND.shortName}</span>
              <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Quản trị</span>
            </span>
          </Link>

          {SidebarContent}

          <div className="mt-auto space-y-3 border-t border-border pt-4">
            <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
              <Link href="/" target="_blank">
                <ExternalLink className="mr-2 h-4 w-4" /> Xem website
              </Link>
            </Button>
            <div className="rounded-lg bg-muted p-3">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              <Badge variant="secondary" className="mt-2">
                {ROLE_LABELS[user.role as Role] ?? user.role}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                logout();
                router.push('/');
              }}
            >
              <LogOut className="mr-2 h-4 w-4" /> Đăng xuất
            </Button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Topbar */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur lg:px-6">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Mở menu quản trị">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-4">
                <SheetHeader className="mb-4 text-left">
                  <SheetTitle className="flex items-center gap-2">
                    <BrandLogo className="h-8 w-8" />
                    <span>
                      <span className="block font-display text-sm font-bold">{BRAND.shortName}</span>
                      <span className="block text-[10px] font-normal uppercase tracking-widest text-muted-foreground">
                        Quản trị
                      </span>
                    </span>
                  </SheetTitle>
                </SheetHeader>
                {SidebarContent}
              </SheetContent>
            </Sheet>

            <p className="font-display text-sm font-semibold">
              {items.find((item) => (item.exact ? pathname === item.href : pathname.startsWith(item.href)))?.label ??
                'Quản trị'}
            </p>

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label="Đổi chế độ sáng/tối"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/">
                  <ExternalLink className="mr-2 h-4 w-4" /> Website
                </Link>
              </Button>
            </div>
          </header>

          <main className="p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
