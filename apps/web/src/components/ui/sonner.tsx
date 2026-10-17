'use client';

import { useTheme } from 'next-themes';
import * as React from 'react';
import { Toaster as Sonner } from 'sonner';

type SonnerProps = React.ComponentProps<typeof Sonner>;

/**
 * Toaster dùng chung cho toàn app: tự đồng bộ theme sáng/tối.
 * Đặt trong `app/layout.tsx` và gọi `toast('...')` từ sonner ở client component.
 */
export function Toaster(props: SonnerProps) {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as SonnerProps['theme']}
      className="toaster group"
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:border-border group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:shadow-card',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
}
