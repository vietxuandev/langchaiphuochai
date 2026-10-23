'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, Heart, MapPin, Menu, Phone, Search, User as UserIcon, LayoutDashboard } from 'lucide-react';
import { BRAND, PostType, ROLE_LABELS, type Role } from '@phuochai/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { UserAvatar } from '@/components/ui/user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/utils';
import type { CategoryNodeFragment } from '@/generated/graphql';

interface SiteHeaderProps {
  categories: CategoryNodeFragment[];
}

const SECTION_LINKS: { type: PostType; label: string; href: string }[] = [
  { type: PostType.ACCOMMODATION, label: 'Nơi lưu trú', href: '/luu-tru' },
  { type: PostType.NEWS, label: 'Tin tức', href: '/tin-tuc' },
  { type: PostType.REAL_ESTATE, label: 'Bất động sản', href: '/bat-dong-san' },
];

/** Logo dạng SVG nội tuyến để không phụ thuộc file ảnh. */
function Logo() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-hero-gradient text-white shadow-soft">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M2 17c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2" strokeLinecap="round" />
          <path d="M12 3v8" strokeLinecap="round" />
          <path d="M8.5 6.5 12 3l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="13" r="2.2" />
        </svg>
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-display text-base font-bold leading-tight tracking-tight text-sea-700 sm:text-lg">
          {BRAND.name}
        </span>
        {/* Tagline chỉ hiện từ sm trở lên để header không tràn ngang trên điện thoại nhỏ */}
        <span className="hidden text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground sm:block">
          Lưu trú &amp; Du lịch
        </span>
      </span>
    </Link>
  );
}

function NavDropdown({ label, href, items }: { label: string; href: string; items: CategoryNodeFragment[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <Link
        href={href}
        className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition hover:bg-muted hover:text-primary"
      >
        {label}
        {items.length > 0 ? <ChevronDown className="h-4 w-4" /> : null}
      </Link>
      {open && items.length > 0 ? (
        <div className="absolute left-0 top-full z-50 w-64 rounded-xl border border-border bg-popover p-2 shadow-card">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/danh-muc/${item.slug}`}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition hover:bg-muted"
            >
              <span>{item.name}</span>
              <Badge variant="muted" className="text-[10px]">
                {item.postCount}
              </Badge>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AuthMenu() {
  const { user, loading, logout, canManageSystem } = useAuth();
  const router = useRouter();

  if (loading) return <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" />;

  if (!user) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dang-nhap">Đăng nhập</Link>
        </Button>
        <Button size="sm" className="hidden sm:inline-flex" asChild>
          <Link href="/dang-ky">Đăng ký</Link>
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserAvatar name={user.name} avatarUrl={user.avatarUrl} className="h-6 w-6 text-xs" />
          <span className="hidden max-w-24 truncate sm:inline">{user.name}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <span className="block text-sm font-semibold">{user.name}</span>
          <span className="block text-xs font-normal text-muted-foreground">
            {ROLE_LABELS[user.role as Role] ?? user.role}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/quan-tri">
            <LayoutDashboard className="mr-2 h-4 w-4" /> Bảng điều khiển
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/quan-tri/tai-khoan">
            <UserIcon className="mr-2 h-4 w-4" /> Tài khoản của tôi
          </Link>
        </DropdownMenuItem>
        {canManageSystem ? (
          <DropdownMenuItem asChild>
            <Link href="/quan-tri/nguoi-dung">
              <UserIcon className="mr-2 h-4 w-4" /> Quản lý người dùng
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            logout();
            router.push('/');
          }}
        >
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SearchBox({ className, onSubmit }: { className?: string; onSubmit?: () => void }) {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  return (
    <form
      className={cn('relative', className)}
      onSubmit={(event) => {
        event.preventDefault();
        const value = keyword.trim();
        if (!value) return;
        router.push(`/tim-kiem?q=${encodeURIComponent(value)}`);
        onSubmit?.();
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        placeholder="Tìm homestay, quán ăn, điểm đến..."
        className="pl-9"
        aria-label="Tìm kiếm"
      />
    </form>
  );
}

/** Header công khai: điều hướng theo danh mục, tìm kiếm, khu vực tài khoản. */
export function SiteHeader({ categories }: SiteHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const bySection = (type: PostType) => categories.filter((category) => category.section === type && category.level >= 1);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="hidden bg-sea-700 text-white lg:block">
        <div className="container flex h-9 items-center justify-between text-xs">
          <p className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5" /> {BRAND.tagline} - {BRAND.address}
          </p>
          <div className="flex items-center gap-4">
            <a href={`tel:${BRAND.phone}`} className="flex items-center gap-1.5 hover:underline">
              <Phone className="h-3.5 w-3.5" /> {BRAND.phoneDisplay}
            </a>
            <span className="flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5" /> Hơn 400 địa điểm &amp; bài viết
            </span>
          </div>
        </div>
      </div>

      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Mở menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto p-0">
              <SheetHeader className="border-b p-4 text-left">
                <SheetTitle>Danh mục</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 p-4">
                <SearchBox onSubmit={() => setMobileOpen(false)} />
                {SECTION_LINKS.map((section) => (
                  <div key={section.type}>
                    <Link
                      href={section.href}
                      onClick={() => setMobileOpen(false)}
                      className="block py-1 font-display text-sm font-semibold text-sea-700"
                    >
                      {section.label}
                    </Link>
                    <div className="mt-1 space-y-0.5">
                      {bySection(section.type).map((category) => (
                        <Link
                          key={category.id}
                          href={`/danh-muc/${category.slug}`}
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          {category.name}
                          <span className="text-xs">{category.postCount}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>

          <Logo />
        </div>

        <nav className="hidden items-center gap-1 lg:flex">
          {SECTION_LINKS.map((section) => (
            <NavDropdown
              key={section.type}
              label={section.label}
              href={section.href}
              items={bySection(section.type)}
            />
          ))}
          <Link
            href="/gioi-thieu"
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition hover:bg-muted hover:text-primary',
              pathname === '/gioi-thieu' && 'bg-muted text-primary',
            )}
          >
            Giới thiệu
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <SearchBox className="hidden w-64 xl:block" />
          <AuthMenu />
        </div>
      </div>
    </header>
  );
}
