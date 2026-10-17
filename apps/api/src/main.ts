import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: false });

  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').map((origin) => origin.trim()),
    credentials: true,
  });
  // Lưu ý: KHÔNG dùng ValidationPipe toàn cục cho GraphQL - class-transformer sẽ
  // biến input object thành {} trước khi tới ZodPipe. Mọi input đều được validate bằng zod ở @Args.
  app.enableShutdownHooks();

  const port = Number.parseInt(process.env.PORT ?? '4000', 10);
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`GraphQL API: http://localhost:${port}/graphql`);
  logger.log(`Ảnh upload  : http://localhost:${port}/upload/...`);
  logger.log(`Môi trường  : ${process.env.NODE_ENV ?? 'development'}`);
}

void bootstrap();
