/**
 * Sinh file `schema.graphql` từ các resolver (code-first) mà KHÔNG cần kết nối database.
 * Dùng cho graphql-codegen ở frontend: `npm run schema:emit -w @phuochai/api`.
 */
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { GraphQLSchemaBuilderModule, GraphQLSchemaFactory } from '@nestjs/graphql';
import { printSchema } from 'graphql';
import { AuthResolver } from '../src/auth/auth.resolver';
import { CategoriesResolver } from '../src/categories/categories.resolver';
import { PostsResolver } from '../src/posts/posts.resolver';
import { StatsResolver } from '../src/stats/stats.resolver';
import { UsersResolver } from '../src/users/users.resolver';

async function main(): Promise<void> {
  const app = await NestFactory.create(GraphQLSchemaBuilderModule, { logger: false });
  await app.init();

  const factory = app.get(GraphQLSchemaFactory);
  const schema = await factory.create([
    AuthResolver,
    UsersResolver,
    CategoriesResolver,
    PostsResolver,
    StatsResolver,
  ]);

  const output = process.env.SCHEMA_PATH ?? join(process.cwd(), 'schema.graphql');
  writeFileSync(output, printSchema(schema), 'utf8');
  console.log(`Đã ghi GraphQL schema vào ${output}`);
  await app.close();
}

main().catch((error) => {
  console.error('Không sinh được schema:', error);
  process.exit(1);
});
