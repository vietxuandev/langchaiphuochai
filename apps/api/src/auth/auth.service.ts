import { createHash } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import {
  NotificationSeverity,
  NotificationType,
  type LoginInput,
  type RegisterInput,
} from '@phuochai/shared';
import { Role, UserStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface LoginContext {
  ip?: string;
  userAgent?: string;
}

const FAILED_LOGIN_EMAIL_THRESHOLD = 5;
const FAILED_LOGIN_IP_THRESHOLD = 10;
const FAILED_LOGIN_WINDOW_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
    private readonly jwt: JwtService,
  ) {}

  private async sign(user: { id: string; email: string; role: Role }): Promise<string> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return this.jwt.signAsync(payload);
  }

  async login(input: LoginInput, meta?: LoginContext) {
    const ipHash = this.hashIp(meta?.ip);
    const user = await this.users.findByEmail(input.email);

    if (!user) {
      await this.recordFailedLogin(input.email, ipHash, meta);
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // Kiểm tra mật khẩu trước để không tiết lộ trạng thái tài khoản cho người lạ
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      await this.recordFailedLogin(input.email, ipHash, meta);
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (user.status === UserStatus.PENDING) {
      throw new UnauthorizedException('Tài khoản đang chờ quản trị viên duyệt');
    }
    if (user.status === UserStatus.REJECTED) {
      throw new UnauthorizedException('Yêu cầu đăng ký của bạn đã bị từ chối');
    }
    if (!user.isActive) throw new UnauthorizedException('Tài khoản đã bị vô hiệu hoá');

    await this.users.markLogin(user.id);
    await this.users.recordLoginAttempt({
      email: user.email,
      ipHash,
      userAgent: meta?.userAgent,
      success: true,
      userId: user.id,
    });

    return {
      accessToken: await this.sign(user),
      user: await this.users.getPublicById(user.id),
    };
  }

  /**
   * Ghi nhận lần đăng nhập sai và cảnh báo admin khi vượt ngưỡng.
   * Lỗi ghi nhận/thông báo không được làm thay đổi lỗi xác thực trả về.
   */
  private async recordFailedLogin(
    rawEmail: string,
    ipHash: string | undefined,
    meta: LoginContext | undefined,
  ): Promise<void> {
    const email = rawEmail.trim().toLowerCase();

    try {
      await this.users.recordLoginAttempt({
        email,
        ipHash,
        userAgent: meta?.userAgent,
        success: false,
      });

      const { byEmail, byIp } = await this.users.countRecentFailedLogins(
        email,
        ipHash,
        FAILED_LOGIN_WINDOW_MINUTES,
      );

      if (byEmail < FAILED_LOGIN_EMAIL_THRESHOLD && byIp < FAILED_LOGIN_IP_THRESHOLD) return;

      const hourBucket = new Date().toISOString().slice(0, 13);
      const detail =
        byIp >= FAILED_LOGIN_IP_THRESHOLD
          ? `${byEmail} lần cho tài khoản này, ${byIp} lần từ cùng IP`
          : `${byEmail} lần cho tài khoản này`;

      await this.notifications.notifyAdmins({
        roles: [Role.ADMIN],
        type: NotificationType.SECURITY_LOGIN_FAILED,
        severity: NotificationSeverity.URGENT,
        title: 'Cảnh báo đăng nhập thất bại',
        body: `${email} — ${detail} trong ${FAILED_LOGIN_WINDOW_MINUTES} phút.`,
        entityType: 'security',
        entityId: this.hashEmail(email),
        actionUrl: '/quan-tri/nguoi-dung',
        dedupeKey: `security:login:${this.hashEmail(email)}:${hourBucket}`,
      });
    } catch (error) {
      this.logger.warn(`Không xử lý được cảnh báo đăng nhập: ${(error as Error).message}`);
    }
  }

  private hashIp(ip?: string): string | undefined {
    if (!ip) return undefined;
    return createHash('sha256').update(`${ip}:${process.env.JWT_SECRET ?? 'dev'}`).digest('hex');
  }

  private hashEmail(email: string): string {
    return createHash('sha256').update(email).digest('hex').slice(0, 16);
  }

  /**
   * Tự đăng ký: tài khoản vào trạng thái chờ duyệt, **không** trả token.
   * Quản trị viên duyệt (và cấp vai trò) thì mới đăng nhập được.
   */
  async register(input: RegisterInput) {
    const user = await this.users.register({
      name: input.name,
      email: input.email,
      password: input.password,
    });

    return {
      user,
      requiresApproval: true,
      message: 'Đăng ký thành công. Tài khoản đang chờ quản trị viên duyệt.',
    };
  }

  async me(userId: string) {
    return this.users.getPublicById(userId);
  }
}
