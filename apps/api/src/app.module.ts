import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { AffiliateModule } from './affiliate/affiliate.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { CrawlerModule } from './crawler/crawler.module';
import { aliasLimitRule } from './common/graphql-limits';
import { GqlAuthGuard, RolesGuard } from './common/guards';
import { NotificationsModule } from './notifications/notifications.module';
import { McpModule } from './mcp/mcp.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';
import { StatsModule } from './stats/stats.module';
import { HealthController } from './health.controller';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

/** Thư mục chứa ảnh của server mới (upload + ảnh import), phục vụ tại /upload/*. */
const uploadRoot = process.env.UPLOAD_DIR ?? join(process.cwd(), '../../data/upload');

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Introspection + Apollo Sandbox: mặc định chỉ bật khi không phải production
 * (frontend sinh type từ file `schema.graphql`, không cần introspection lúc chạy).
 * Đặt GRAPHQL_INTROSPECTION=true để bật tạm trên production khi cần debug.
 */
const graphqlIntrospection = process.env.GRAPHQL_INTROSPECTION
  ? process.env.GRAPHQL_INTROSPECTION === 'true'
  : !isProduction;

/** Mã lỗi do client gửi sai (cú pháp, field không tồn tại...) - không phải lỗi máy chủ. */
const CLIENT_ERROR_CODES = new Set([
  'GRAPHQL_PARSE_FAILED',
  'GRAPHQL_VALIDATION_FAILED',
  'BAD_USER_INPUT',
  'BAD_REQUEST',
  'PERSISTED_QUERY_NOT_FOUND',
  'PERSISTED_QUERY_NOT_SUPPORTED',
  'OPERATION_RESOLUTION_FAILURE',
]);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../../.env'],
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // Dev: sinh schema code-first ra file để frontend dùng graphql-codegen.
      // Production: dựng schema trong bộ nhớ (app chạy bằng user không phải root, không ghi file).
      autoSchemaFile: process.env.SCHEMA_PATH ?? (isProduction ? true : join(process.cwd(), 'schema.graphql')),
      sortSchema: true,
      introspection: graphqlIntrospection,
      playground: false,
      plugins: [
        graphqlIntrospection
          ? ApolloServerPluginLandingPageLocalDefault({ footer: false })
          : ApolloServerPluginLandingPageDisabled(),
      ],
      // Chặn gộp nhiều lần login/register (hoặc nhân query nặng) trong một request bằng alias.
      validationRules: [aliasLimitRule({ maxAliases: 20, singleUseMutations: ['login', 'register'] })],
      context: ({ req }: { req: unknown }) => ({ req }),
      formatError: (error) => {
        const original = error.extensions?.originalError as
          | { message?: string | string[]; statusCode?: number }
          | undefined;
        const message = Array.isArray(original?.message)
          ? original.message.join('; ')
          : (original?.message ?? error.message);

        // Ánh xạ mã HTTP của Nest sang mã lỗi GraphQL để frontend xử lý thống nhất.
        const rawCode = typeof error.extensions?.code === 'string' ? error.extensions.code : undefined;
        const statusCode = original?.statusCode ?? (rawCode && CLIENT_ERROR_CODES.has(rawCode) ? 400 : 500);
        const codeByStatus: Record<number, string> = {
          400: 'BAD_REQUEST',
          401: 'UNAUTHENTICATED',
          403: 'FORBIDDEN',
          404: 'NOT_FOUND',
          409: 'CONFLICT',
          429: 'TOO_MANY_REQUESTS',
        };
        const code =
          (original?.statusCode ? codeByStatus[original.statusCode] : undefined) ?? rawCode ?? 'INTERNAL_SERVER_ERROR';

        // Lỗi nội bộ (lỗi Prisma, bug...) trên production: không lộ chi tiết truy vấn/đường dẫn file
        // cho client. Nest đã ghi log lỗi gốc ở server.
        const hideDetails = isProduction && code === 'INTERNAL_SERVER_ERROR' && statusCode >= 500;

        return {
          message: hideDetails ? 'Lỗi máy chủ, vui lòng thử lại sau' : message,
          path: error.path,
          extensions: {
            code,
            statusCode,
            ...(isProduction ? {} : { details: error.extensions?.details }),
          },
        };
      },
    }),
    // Phục vụ ảnh do server mới quản lý: GET /upload/<path>
    ServeStaticModule.forRoot({
      rootPath: uploadRoot,
      serveRoot: '/upload',
      serveStaticOptions: { index: false, fallthrough: true, maxAge: '7d' },
    }),
    PrismaModule,
    AffiliateModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    CrawlerModule,
    McpModule,
    PostsModule,
    StatsModule,
    UploadsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Thứ tự quan trọng: xác thực trước, phân quyền sau.
    { provide: APP_GUARD, useClass: GqlAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
