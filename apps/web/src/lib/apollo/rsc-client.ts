import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { registerApolloClient } from '@apollo/client-integration-nextjs';
import { unstable_cache } from 'next/cache';
import { print } from 'graphql';

/**
 * Lúc `next build`, ưu tiên API_BUILD_URL (API thật hoặc domain public đang chạy).
 * Lúc runtime, API_BUILD_URL không được set nên dùng API_INTERNAL_URL nội bộ Docker.
 */
const apiBaseUrl =
  process.env.API_BUILD_URL || process.env.API_INTERNAL_URL || 'http://localhost:4000';

/**
 * Apollo Client dùng trong React Server Component.
 * Gọi API qua mạng nội bộ (API_INTERNAL_URL) - trong Docker là `http://api:4000`.
 */
export const { getClient } = registerApolloClient(
  () =>
    new ApolloClient({
      cache: new InMemoryCache(),
      link: new HttpLink({
        uri: `${apiBaseUrl}/graphql`,
      }),
      defaultOptions: {
        query: { fetchPolicy: 'no-cache', errorPolicy: 'all' },
      },
    }),
);

export interface SafeQueryOptions {
  /** `false` = luôn gọi API, bỏ qua cache dữ liệu 60 giây (khi cần dữ liệu mới nhất). */
  cache?: boolean;
}

type GraphQLErrorLike = { message: string; extensions?: Record<string, unknown> };

/** Lỗi chỉ gồm NOT_FOUND là kết quả hợp lệ (trang 404), không phải sự cố của API. */
function isNotFoundOnly(errors: ReadonlyArray<GraphQLErrorLike>): boolean {
  return errors.length > 0 && errors.every((error) => error.extensions?.code === 'NOT_FOUND');
}

/** Đang chạy `next build` (API có thể chưa sẵn sàng). */
function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

/**
 * Truy vấn GraphQL cho React Server Component.
 *
 * - API trả NOT_FOUND -> dùng `fallback` (trang hiển thị 404 như bình thường).
 * - API lỗi / không kết nối được khi đang chạy thật -> NÉM lỗi. Nhờ vậy Next giữ nguyên bản
 *   ISR đang cache thay vì lưu đè bằng trang rỗng/404 (trước đây chỉ cần API restart vài giây
 *   lúc deploy là bài có thật có thể bị cache thành 404 trong 5 phút).
 * - Lúc `next build` -> dùng `fallback` để build không hỏng khi API chưa chạy.
 */
export async function safeQuery<TData, TVariables extends Record<string, unknown>>(
  query: Parameters<ReturnType<typeof getClient>['query']>[0]['query'],
  variables: TVariables,
  fallback: TData,
  options: SafeQueryOptions = {},
): Promise<TData> {
  const run = async (): Promise<TData> => {
    const client = getClient();
    const result = await client.query<TData, TVariables>({ query, variables });
    const errors = (result.errors ?? []) as ReadonlyArray<GraphQLErrorLike>;
    if (errors.length > 0) {
      if (isNotFoundOnly(errors)) return fallback;
      // Ném lỗi bên trong hàm cache: unstable_cache không lưu kết quả lỗi
      throw new Error(`GraphQL lỗi: ${errors.map((error) => error.message).join('; ')}`);
    }
    if (!result.data) throw new Error('GraphQL không trả về dữ liệu');
    return result.data as TData;
  };

  try {
    if (options.cache === false) return await run();

    // Cache dữ liệu RSC ngắn hạn để giảm tải API khi nhiều người xem cùng trang.
    // HTML vẫn có thể được cache riêng ở tầng route/ISR khi bật.
    const cached = unstable_cache(run, ['graphql', print(query), JSON.stringify(variables)], {
      revalidate: 60,
      tags: ['graphql'],
    });
    return await cached();
  } catch (error) {
    if (isBuildPhase()) {
      console.warn('[RSC] Build: không truy vấn được GraphQL, dùng dữ liệu mặc định:', (error as Error).message);
      return fallback;
    }
    throw error;
  }
}
