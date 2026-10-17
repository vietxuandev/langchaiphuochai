import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { registerApolloClient } from '@apollo/client-integration-nextjs';

/**
 * Apollo Client dùng trong React Server Component.
 * Gọi API qua mạng nội bộ (API_INTERNAL_URL) - trong Docker là `http://api:4000`.
 */
export const { getClient } = registerApolloClient(
  () =>
    new ApolloClient({
      cache: new InMemoryCache(),
      link: new HttpLink({
        uri: `${process.env.API_INTERNAL_URL ?? 'http://localhost:4000'}/graphql`,
      }),
      defaultOptions: {
        query: { fetchPolicy: 'no-cache', errorPolicy: 'all' },
      },
    }),
);

/**
 * Truy vấn an toàn cho RSC: nếu API lỗi/chưa chạy thì trả về giá trị mặc định
 * thay vì làm sập trang (ví dụ trong lúc `next build`).
 */
export async function safeQuery<TData, TVariables extends Record<string, unknown>>(
  query: Parameters<ReturnType<typeof getClient>['query']>[0]['query'],
  variables: TVariables,
  fallback: TData,
): Promise<TData> {
  try {
    const client = getClient();
    const result = await client.query<TData, TVariables>({ query, variables });
    return (result.data ?? fallback) as TData;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[RSC] Không truy vấn được GraphQL:', (error as Error).message);
    }
    return fallback;
  }
}
