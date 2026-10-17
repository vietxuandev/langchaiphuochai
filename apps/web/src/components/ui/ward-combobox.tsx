'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, MapPin, Search, X } from 'lucide-react';
import { WARDS, searchWards, type Ward } from '@phuochai/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface WardComboboxProps {
  /** Tên xã/phường đã chọn (tên chuẩn), hoặc rỗng. */
  value?: string | null;
  onChange: (ward: string | undefined) => void;
  placeholder?: string;
  /** Cho phép bỏ chọn (dùng cho bộ lọc). */
  allowClear?: boolean;
  id?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Dropdown chọn **xã/phường** có autocomplete (không phân biệt dấu).
 *
 * Dữ liệu lấy từ danh mục 168 xã/phường/đặc khu của TP. Hồ Chí Minh
 * (`@phuochai/shared` → `WARDS`). Việt Nam đã bỏ cấp quận/huyện nên không còn
 * trường quận/huyện trong hệ thống.
 */
export function WardCombobox({
  value,
  onChange,
  placeholder = 'Chọn xã / phường',
  allowClear = false,
  id,
  className,
  disabled = false,
}: WardComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => searchWards(query, 60), [query]);

  // Mở dropdown thì reset tìm kiếm và focus ô nhập
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(timer);
  }, [open]);

  // Giữ mục đang chọn trong vùng nhìn thấy
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, results]);

  const select = (ward: Ward | undefined): void => {
    onChange(ward ? ward.name : undefined);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const ward = results[activeIndex];
      if (ward) select(ward);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const hasValue = Boolean(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn('flex gap-1', className)}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Chọn xã/phường"
            disabled={disabled}
            className={cn(
              'h-10 w-full justify-between font-normal',
              !hasValue && 'text-muted-foreground',
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 opacity-60" />
              <span className="truncate">{hasValue ? value : placeholder}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        {allowClear && hasValue ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0"
            aria-label="Bỏ chọn xã/phường"
            onClick={() => onChange(undefined)}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" align="start">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-4 w-4 shrink-0 opacity-50" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Tìm xã/phường (gõ không dấu cũng được)..."
            className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
            aria-label="Tìm xã/phường"
            aria-autocomplete="list"
          />
          <span className="shrink-0 text-xs text-muted-foreground">{WARDS.length}</span>
        </div>

        <div ref={listRef} className="max-h-72 overflow-y-auto py-1" role="listbox">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Không tìm thấy xã/phường phù hợp
            </p>
          ) : (
            results.map((ward, index) => {
              const selected = ward.name === value;
              return (
                <button
                  key={ward.code}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-index={index}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm',
                    index === activeIndex && 'bg-accent',
                    selected && 'font-medium',
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => select(ward)}
                >
                  <span className="truncate">{ward.name}</span>
                  {selected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
