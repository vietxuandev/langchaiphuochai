import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { hasAtLeastRole, Role } from '@phuochai/shared';
import { IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY, ROLES_KEY } from '../common/decorators';
import type { UserEntity } from '../users/entities/user.entity';

/**
 * Guard xác thực JWT cho GraphQL.
 * - Mặc định: yêu cầu đăng nhập.
 * - `@Public()`: bỏ qua xác thực.
 * - `@OptionalAuth()`: cho phép khách, nhưng nếu có token hợp lệ thì vẫn gắn user.
 */
@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  override handleRequest<TUser = UserEntity>(
    error: unknown,
    user: TUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser | null {
    const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (optional) return (user || null) as TUser | null;
    if (error || !user) {
      throw error instanceof Error ? error : new UnauthorizedException('Bạn cần đăng nhập để thực hiện thao tác này');
    }
    return user;
  }

  override getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext<{ req: unknown }>().req;
  }
}

/**
 * Lấy người dùng từ request - hoạt động cho cả GraphQL resolver và REST controller.
 */
export function getRequestUser(context: ExecutionContext): UserEntity | undefined {
  try {
    const gqlContext = GqlExecutionContext.create(context).getContext<{ req?: { user?: UserEntity } }>();
    if (gqlContext?.req?.user) return gqlContext.req.user;
  } catch {
    // Không phải ngữ cảnh GraphQL - chuyển sang HTTP
  }
  try {
    return context.switchToHttp().getRequest<{ user?: UserEntity }>()?.user;
  } catch {
    return undefined;
  }
}

/** Kiểm tra vai trò: `@Roles(Role.ADMIN)`. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = getRequestUser(context);
    if (!user) throw new UnauthorizedException('Bạn cần đăng nhập');

    const allowed = required.some((role) => hasAtLeastRole(user.role as Role, role));
    if (!allowed) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }
    return true;
  }
}
