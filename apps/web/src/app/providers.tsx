'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApolloClientProvider } from '@/lib/apollo/apollo-provider';
import { AuthProvider } from '@/lib/auth/auth-context';

/**
 * Gom toàn bộ provider phía client: Apollo → Auth → Theme → Tooltip → Toast.
 *
 * `TooltipProvider` bắt buộc phải bọc ngoài mọi `<Tooltip>` (Radix yêu cầu),
 * ví dụ thanh công cụ của editor trực quan trong trang quản trị bài viết.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ApolloClientProvider>
      <AuthProvider>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={200} skipDelayDuration={300}>
            {children}
            <Toaster position="top-right" richColors closeButton />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </ApolloClientProvider>
  );
}
