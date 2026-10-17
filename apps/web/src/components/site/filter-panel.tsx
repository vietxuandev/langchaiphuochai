'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, X } from 'lucide-react';
import { PostType } from '@phuochai/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { WardCombobox } from '@/components/ui/ward-combobox';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  postCount: number;
  level?: number;
}

export interface ListingFilters {
  categorySlug?: string;
  /** Xã/phường (TP. Hồ Chí Minh) - đã bỏ cấp quận/huyện. */
  ward?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'CREATED_AT' | 'PUBLISHED_AT' | 'PRICE' | 'VIEWS' | 'TITLE';
  sortOrder?: 'ASC' | 'DESC';
}

interface FilterPanelProps {
  type: PostType;
  categories: CategoryOption[];
  filters: ListingFilters;
  total: number;
  onChange: (filters: ListingFilters) => void;
}

const SORT_OPTIONS: {
  value: string;
  label: string;
  sortBy: ListingFilters['sortBy'];
  sortOrder: 'ASC' | 'DESC';
}[] = [
  { value: 'newest', label: 'Mới nhất', sortBy: 'PUBLISHED_AT', sortOrder: 'DESC' },
  { value: 'views', label: 'Xem nhiều nhất', sortBy: 'VIEWS', sortOrder: 'DESC' },
  { value: 'price-asc', label: 'Giá thấp → cao', sortBy: 'PRICE', sortOrder: 'ASC' },
  { value: 'price-desc', label: 'Giá cao → thấp', sortBy: 'PRICE', sortOrder: 'DESC' },
  { value: 'title', label: 'Tên A → Z', sortBy: 'TITLE', sortOrder: 'ASC' },
];

const PRICE_RANGES = [
  { value: 'all', label: 'Mọi mức giá' },
  { value: '0-500000', label: 'Dưới 500 nghìn' },
  { value: '500000-1000000', label: '500 nghìn - 1 triệu' },
  { value: '1000000-2000000', label: '1 - 2 triệu' },
  { value: '2000000-5000000', label: '2 - 5 triệu' },
  { value: '5000000-', label: 'Trên 5 triệu' },
];

/** Bộ lọc dùng chung cho các trang danh sách (desktop: sidebar, mobile: sheet). */
export function FilterPanel({ type, categories, filters, total, onChange }: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const sortValue = useMemo(() => {
    const found = SORT_OPTIONS.find(
      (option) => option.sortBy === filters.sortBy && option.sortOrder === filters.sortOrder,
    );
    return found?.value ?? 'newest';
  }, [filters.sortBy, filters.sortOrder]);

  const priceValue = useMemo(() => {
    if (filters.minPrice == null && filters.maxPrice == null) return 'all';
    return `${filters.minPrice ?? 0}-${filters.maxPrice ?? ''}`;
  }, [filters.minPrice, filters.maxPrice]);

  const activeCount = [
    filters.categorySlug,
    filters.ward,
    filters.minPrice ?? filters.maxPrice,
  ].filter(Boolean).length;

  const panel = (
    <div className="space-y-5">
      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Danh mục</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => onChange({ ...filters, categorySlug: undefined })}>
            <Badge variant={!filters.categorySlug ? 'default' : 'outline'} className="cursor-pointer">
              Tất cả
            </Badge>
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => onChange({ ...filters, categorySlug: category.slug })}
            >
              <Badge
                variant={filters.categorySlug === category.slug ? 'default' : 'outline'}
                className="cursor-pointer"
              >
                {category.name} ({category.postCount})
              </Badge>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="filter-ward">Xã / phường</Label>
        <WardCombobox
          id="filter-ward"
          value={filters.ward}
          onChange={(ward) => onChange({ ...filters, ward })}
          allowClear
          placeholder="Tất cả xã/phường"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-price">Khoảng giá</Label>
        <Select
          value={priceValue}
          onValueChange={(value) => {
            if (value === 'all') {
              onChange({ ...filters, minPrice: undefined, maxPrice: undefined });
              return;
            }
            const [min, max] = value.split('-');
            onChange({
              ...filters,
              minPrice: min ? Number(min) : undefined,
              maxPrice: max ? Number(max) : undefined,
            });
          }}
        >
          <SelectTrigger id="filter-price">
            <SelectValue placeholder="Mọi mức giá" />
          </SelectTrigger>
          <SelectContent>
            {PRICE_RANGES.map((range) => (
              <SelectItem key={range.value} value={range.value}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {type === PostType.REAL_ESTATE ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label htmlFor="filter-min">Giá từ (VND)</Label>
            <Input
              id="filter-min"
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={filters.minPrice ?? ''}
              onChange={(event) =>
                onChange({ ...filters, minPrice: event.target.value ? Number(event.target.value) : undefined })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-max">Đến (VND)</Label>
            <Input
              id="filter-max"
              type="number"
              inputMode="numeric"
              placeholder="Không giới hạn"
              value={filters.maxPrice ?? ''}
              onChange={(event) =>
                onChange({ ...filters, maxPrice: event.target.value ? Number(event.target.value) : undefined })
              }
            />
          </div>
        </div>
      ) : null}

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="filter-sort">Sắp xếp</Label>
        <Select
          value={sortValue}
          onValueChange={(value) => {
            const option = SORT_OPTIONS.find((item) => item.value === value);
            if (option) onChange({ ...filters, sortBy: option.sortBy, sortOrder: option.sortOrder });
          }}
        >
          <SelectTrigger id="filter-sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => onChange({ sortBy: 'PUBLISHED_AT', sortOrder: 'DESC' })}
      >
        <X className="mr-2 h-4 w-4" /> Xoá bộ lọc
      </Button>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <Card className="sticky top-24 hidden h-fit border-border/70 p-5 shadow-soft lg:block">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-display text-sm font-semibold uppercase tracking-wide">Bộ lọc</p>
          <Badge variant="muted">{total} kết quả</Badge>
        </div>
        {panel}
      </Card>

      {/* Mobile */}
      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className={cn('w-full', activeCount > 0 && 'border-primary text-primary')}>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Bộ lọc {activeCount > 0 ? `(${activeCount})` : ''} · {total} kết quả
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader className="text-left">
              <SheetTitle>Bộ lọc</SheetTitle>
            </SheetHeader>
            <div className="py-4">{panel}</div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

/** Đồng bộ bộ lọc lên URL để chia sẻ/refresh vẫn giữ trạng thái. */
export function useFilterUrlSync(type: PostType) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (filters: ListingFilters) => {
    const params = new URLSearchParams();
    if (filters.categorySlug) params.set('danh-muc', filters.categorySlug);
    if (filters.ward) params.set('xa-phuong', filters.ward);
    if (filters.minPrice != null) params.set('gia-tu', String(filters.minPrice));
    if (filters.maxPrice != null) params.set('gia-den', String(filters.maxPrice));
    if (filters.sortBy) params.set('sap-xep', String(filters.sortBy));
    if (filters.sortOrder) params.set('thu-tu', filters.sortOrder);
    const keyword = searchParams.get('q');
    if (keyword) params.set('q', keyword);
    const query = params.toString();
    const base = type === PostType.ACCOMMODATION ? '/luu-tru' : type === PostType.NEWS ? '/tin-tuc' : type === PostType.REAL_ESTATE ? '/bat-dong-san' : '/tim-kiem';
    router.replace(query ? `${base}?${query}` : base, { scroll: false });
  };
}
