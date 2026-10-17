import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Role } from '@phuochai/shared';
import type { UserEntity } from '../users/entities/user.entity';

/** Người dùng hiện tại (đã xác thực) - `@CurrentUser() user: UserEntity | null`. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): UserEntity | null => {
  const ctx = GqlExecutionContext.create(context);
  const request = ctx.getContext<{ req?: { user?: UserEntity } }>().req;
  return request?.user ?? null;
});

/** Yêu cầu đã đăng nhập. */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/** Yêu cầu vai trò tối thiểu. */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator => SetMetadata(ROLES_KEY, roles);

/** Cho phép cả khách (không cần token) nhưng vẫn gắn user nếu có token hợp lệ. */
export const OPTIONAL_AUTH_KEY = 'optionalAuth';
export const OptionalAuth = (): MethodDecorator & ClassDecorator => SetMetadata(OPTIONAL_AUTH_KEY, true);
