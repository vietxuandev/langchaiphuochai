import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Bọc PrismaClient thành service dùng chung toàn app.
 * Tự kết nối khi khởi động và ngắt kết nối khi tắt app.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.PRISMA_LOG === 'true' ? ['query', 'warn', 'error'] : ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Đã kết nối PostgreSQL qua Prisma');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Đếm nhanh số bản ghi của một model (dùng cho dashboard). */
  async countSafe(model: 'post' | 'user' | 'category'): Promise<number> {
    try {
      // @ts-expect-error - truy cập động theo tên model
      return (await this[model].count()) as number;
    } catch {
      return 0;
    }
  }
}
