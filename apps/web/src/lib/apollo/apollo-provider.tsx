'use client';

import { ApolloLink, HttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import {
  ApolloNextAppProvider,
  ApolloClient,
  InMemoryCache,
  SSRMultipartLink,
} from '@apollo/client-integration-nextjs';
import { toast } from 'sonner';
import { getToken } from '@/lib/auth/token';
import { notifySessionExpired } from '@/lib/auth/session';

/** Gắn Bearer token vào mọi request nếu người dùng đã đăng nhập. */
const authLink = setContext((_operation, { headers }) => {
  const token = getToken();
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

function makeClient() {
  const httpLink = new HttpLink({
    uri: process.env.NEXT_PUBLIC_GRAPHQL_URL ?? '/graphql',
    credentials: 'same-origin',
  });

  const errorLink = onError(({ operation, graphQLErrors, networkError }) => {
    // Login/register có thể trả lỗi xác thực; không được báo "phiên hết hạn" ở đây.
    const isAuthOperation = operation.operationName === 'Login' || operation.operationName === 'Register';
    const first = graphQLErrors?.[0];
    const code = first?.extensions?.code;
    const statusCode = (networkError as { statusCode?: number } | undefined)?.statusCode;

    if ((code === 'UNAUTHENTICATED' || statusCode === 401) && !isAuthOperation) {
      // Chỉ báo khi đang có token; nếu token đã bị xoá thì các query 401 tiếp theo im lặng.
      if (getToken() && notifySessionExpired()) {
        toast.error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', { id: 'session-expired' });
      }
      return;
    }

    if (code === 'FORBIDDEN') {
      toast.error(first?.message || 'Bạn không có quyền thực hiện thao tác này', { id: 'graphql-forbidden' });
    } else if (networkError) {
      toast.error('Không kết nối được tới máy chủ GraphQL', { id: 'graphql-network' });
    }
  });

  return new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            // Danh sách bài viết: gộp theo bộ lọc + trang để phân trang chính xác.
            posts: {
              keyArgs: ['filter'],
              merge(_existing, incoming) {
                return incoming;
              },
            },
          },
        },
        Post: { keyFields: ['id'] },
        Category: { keyFields: ['id'] },
      },
    }),
    link:
      typeof window === 'undefined'
        ? ApolloLink.from([errorLink, authLink, new SSRMultipartLink({ stripDefer: true }), httpLink])
        : ApolloLink.from([errorLink, authLink, httpLink]),
    defaultOptions: {
      watchQuery: { fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first' },
      query: { fetchPolicy: 'network-only' },
      mutate: { errorPolicy: 'all' },
    },
  });
}

/** Bọc toàn bộ app để dùng Apollo Client ở phía client. */
export function ApolloClientProvider({ children }: { children: React.ReactNode }) {
  return <ApolloNextAppProvider makeClient={makeClient}>{children}</ApolloNextAppProvider>;
}
