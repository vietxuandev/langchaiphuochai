import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, type NextFunction, type Request, type Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: false });

  // Header bảo mật cơ bản cho mọi response của API (cả /upload/* và domain mcp. trỏ thẳng vào API).
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Nội dung bài viết (Markdown/HTML) gửi qua MCP có thể dài hơn 100KB mặc định.
  // Đăng ký trước parser mặc định của Nest nên giới hạn 4MB được áp dụng.
  app.use(
    json({
      limit: '4mb',
      // Giữ body thô để xác thực chữ ký webhook Facebook (X-Hub-Signature-256).
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );

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
