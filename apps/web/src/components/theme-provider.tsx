'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import * as React from 'react';

/**
 * Provider quản lý theme sáng/tối cho toàn bộ app.
 * Dùng trong `app/layout.tsx`: <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
