import { ValidationPipe } from '@nestjs/common';
import type { PipeTransform, ArgumentMetadata } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import type { ZodTypeAny } from 'zod';

/**
 * Pipe validate bằng zod - dùng chung schema với frontend (`@phuochai/shared`).
 * Cách dùng trong resolver: `@Args('input', new ZodPipe(createPostSchema)) input: CreatePostInput`
 */
export class ZodPipe<T extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '(gốc)',
      message: issue.message,
    }));
    const summary = details.map((detail) => `${detail.field}: ${detail.message}`).join('; ');
    throw new BadRequestException(`Dữ liệu không hợp lệ - ${summary}`, { cause: details });
  }
}

/** Tiện ích tạo pipe nhanh: `zodPipe(schema)`. */
export function zodPipe<T extends ZodTypeAny>(schema: T): ZodPipe<T> {
  return new ZodPipe(schema);
}

/** Cấu hình ValidationPipe mặc định (dùng cho REST/health, GraphQL dùng ZodPipe). */
export const globalValidationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
});
