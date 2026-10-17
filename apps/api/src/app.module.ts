import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { GqlAuthGuard, RolesGuard } from './common/guards';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';
import { StatsModule } from './stats/stats.module';
import { HealthController } from './health.controller';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

/** Thư mục chứa ảnh của server mới (upload + ảnh import), phục vụ tại /upload/*. */
const uploadRoot = process.env.UPLOAD_DIR ?? join(process.cwd(), '../../data/upload');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../../.env'],
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // Sinh schema code-first ra file để frontend dùng graphql-codegen.
      autoSchemaFile: process.env.SCHEMA_PATH ?? join(process.cwd(), 'schema.graphql'),
      sortSchema: true,
      introspection: true,
      playground: false,
      plugins: [ApolloServerPluginLandingPageLocalDefault({ footer: false })],
      context: ({ req }: { req: unknown }) => ({ req }),
      formatError: (error) => {
        const original = error.extensions?.originalError as
          | { message?: string | string[]; statusCode?: number }
          | undefined;
        const message = Array.isArray(original?.message)
          ? original.message.join('; ')
          : (original?.message ?? error.message);

        // Ánh xạ mã HTTP của Nest sang mã lỗi GraphQL để frontend xử lý thống nhất.
        const statusCode = original?.statusCode ?? 500;
        const codeByStatus: Record<number, string> = {
          400: 'BAD_REQUEST',
          401: 'UNAUTHENTICATED',
          403: 'FORBIDDEN',
          404: 'NOT_FOUND',
          409: 'CONFLICT',
        };
        const code = codeByStatus[statusCode] ?? error.extensions?.code ?? 'INTERNAL_SERVER_ERROR';

        return {
          message,
          path: error.path,
          extensions: {
            code,
            statusCode,
            ...(process.env.NODE_ENV === 'production' ? {} : { details: error.extensions?.details }),
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
    AuthModule,
    UsersModule,
    CategoriesModule,
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
