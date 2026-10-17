import type { CodegenConfig } from '@graphql-codegen/cli';

/**
 * Sinh type + React hook (Apollo) từ GraphQL schema và các document trong `src/graphql`.
 * Chạy: `npm run codegen` (sau khi API đã sinh `apps/api/schema.graphql`, hoặc dùng endpoint đang chạy).
 */
const config: CodegenConfig = {
  schema: process.env.GRAPHQL_SCHEMA ?? '../api/schema.graphql',
  documents: ['src/graphql/**/*.graphql'],
  ignoreNoDocuments: true,
  generates: {
    'src/generated/graphql.tsx': {
      plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
      config: {
        withHooks: true,
        withComponent: false,
        withHOC: false,
        apolloClientVersion: 3,
        // Enum sinh ra dưới dạng union string để khớp với @phuochai/shared
        enumsAsTypes: true,
        avoidOptionals: false,
        dedupeOperationSuffix: true,
        scalars: {
          JSON: 'unknown',
          DateTime: 'string',
        },
      },
    },
  },
};

export default config;
