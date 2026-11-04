import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Role, UserStatus, type User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  NotificationSeverity,
  NotificationType,
  type AdminCreateUserInput,
  type UpdateUserInput,
} from '@phuochai/shared';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

export interface UserListFilter {
  keyword?: string;
  role?: Role;
  isActive?: boolean;
  status?: UserStatus;
  page: number;
  pageSize: number;
}

/** Input tạo tài khoản do quản trị viên tạo (khác với tự đăng ký). */
export interface AdminCreateUserInputWithStatus {
  name: string;
  email: string;
  password: string;
  role: Role;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Bỏ passwordHash trước khi trả ra ngoài. */
  static toPublic(user: User & { _count?: { posts: number } }) {
    const { passwordHash: _passwordHash, _count, ...rest } = user;
    return { ...rest, postCount: _count?.posts };
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByIdOrFail(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user;
  }

  async getPublicById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { _count: { select: { posts: true } } } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return UsersService.toPublic(user);
  }

  async list(filter: UserListFilter) {
    const where: Prisma.UserWhereInput = {};
    if (filter.role) where.role = filter.role;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    if (filter.status) where.status = filter.status;
    if (filter.keyword) {
      where.OR = [
        { name: { contains: filter.keyword, mode: 'insensitive' } },
        { email: { contains: filter.keyword, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: { _count: { select: { posts: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);

    return {
      items: users.map((user) => UsersService.toPublic(user)),
      total,
      page: filter.page,
      pageSize: filter.pageSize,
      totalPages: Math.max(1, Math.ceil(total / filter.pageSize)),
    };
  }

  /** Quản trị viên tạo tài khoản: duyệt luôn (ACTIVE). */
  async create(input: AdminCreateUserInput) {
    const email = input.email.toLowerCase();
    const existing = await this.findByEmail(email);
    if (existing) throw new ConflictException('Email này đã được sử dụng');

    const user = await this.prisma.user.create({
      data: {
        email,
        name: input.name,
        role: input.role as Role,
        passwordHash: await bcrypt.hash(input.password, 10),
        status: UserStatus.ACTIVE,
        isActive: true,
        approvedAt: new Date(),
        reviewNote: 'Tạo trực tiếp bởi quản trị viên',
      },
    });
    return UsersService.toPublic(user);
  }

  /**
   * Tự đăng ký: tạo tài khoản ở trạng thái PENDING, chưa đăng nhập được.
   * Quản trị viên duyệt (có thể cấp vai trò) thì mới hoạt động.
   */
  async register(input: { name: string; email: string; password: string }) {
    const email = input.email.toLowerCase();
    const existing = await this.findByEmail(email);
    if (existing) throw new ConflictException('Email này đã được sử dụng');

    const user = await this.prisma.user.create({
      data: {
        email,
        name: input.name,
        role: Role.USER,
        passwordHash: await bcrypt.hash(input.password, 10),
        status: UserStatus.PENDING,
        isActive: false,
      },
    });

    try {
      await this.notifications.notifyAdmins({
        roles: [Role.ADMIN],
        type: NotificationType.USER_PENDING,
        severity: NotificationSeverity.WARNING,
        title: 'Tài khoản mới chờ duyệt',
        body: `${user.name} (${user.email})`,
        entityType: 'user',
        entityId: user.id,
        actionUrl: '/quan-tri/nguoi-dung?status=PENDING',
        dedupeKey: `user:${user.id}:pending`,
      });
    } catch (error) {
      // Đăng ký vẫn phải thành công kể cả khi tạo thông báo lỗi.
      this.logger.warn(`Không tạo được thông báo đăng ký: ${(error as Error).message}`);
    }

    return UsersService.toPublic(user);
  }

  /** Quản trị viên duyệt tài khoản, có thể cấp vai trò ngay khi duyệt. */
  async approve(id: string, role?: Role) {
    await this.findByIdOrFail(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.ACTIVE,
        isActive: true,
        role: role ?? undefined,
        approvedAt: new Date(),
        reviewNote: null,
      },
    });
    return UsersService.toPublic(user);
  }

  /** Quản trị viên từ chối tài khoản (kèm lý do nếu có). */
  async reject(id: string, note?: string) {
    await this.findByIdOrFail(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.REJECTED,
        isActive: false,
        approvedAt: null,
        reviewNote: note?.trim() || null,
      },
    });
    return UsersService.toPublic(user);
  }

  /**
   * Xoá tài khoản (dành cho tài khoản rác/chờ duyệt bị từ chối).
   * Không cho xoá ADMIN hoặc tài khoản đã có bài viết để tránh mất dữ liệu.
   */
  async remove(id: string) {
    const user = await this.findByIdOrFail(id);
    if (user.role === Role.ADMIN) {
      throw new ConflictException('Không thể xoá tài khoản quản trị viên');
    }
    const posts = await this.prisma.post.count({ where: { authorId: id } });
    if (posts > 0) {
      throw new ConflictException(
        `Tài khoản đã có ${posts} bài viết - hãy chuyển bài sang tài khoản khác hoặc vô hiệu hoá thay vì xoá`,
      );
    }
    await this.prisma.user.delete({ where: { id } });
    return true;
  }

  /** Số tài khoản đang chờ duyệt (hiện badge trên menu quản trị). */
  async countPending(): Promise<number> {
    return this.prisma.user.count({ where: { status: UserStatus.PENDING } });
  }

  async update(id: string, input: UpdateUserInput) {
    await this.findByIdOrFail(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: input.name,
        role: input.role as Role | undefined,
        isActive: input.isActive,
      },
    });
    return UsersService.toPublic(user);
  }

  /**
   * Cập nhật hồ sơ: `undefined` = giữ nguyên, `null` = xoá giá trị
   * (ví dụ người dùng bấm "Xoá ảnh" rồi lưu).
   */
  async updateProfile(
    id: string,
    input: { name?: string; avatarUrl?: string | null; bio?: string | null; phone?: string | null },
  ) {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: input.name,
        avatarUrl: input.avatarUrl,
        bio: input.bio,
        phone: input.phone,
      },
    });
    return UsersService.toPublic(user);
  }

  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<boolean> {
    const user = await this.findByIdOrFail(id);
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return false;
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    return true;
  }

  /** Vô hiệu hoá tài khoản (không xoá cứng để giữ liên kết bài viết). */
  async deactivate(id: string) {
    const user = await this.findByIdOrFail(id);
    const updated = await this.prisma.user.update({ where: { id }, data: { isActive: false } });
    return { ...UsersService.toPublic(updated), email: user.email };
  }

  async markLogin(id: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }

  /** Ghi nhận một lần đăng nhập để phát hiện brute-force; lỗi ghi log không chặn đăng nhập. */
  async recordLoginAttempt(input: {
    email: string;
    ipHash?: string;
    userAgent?: string;
    success: boolean;
    userId?: string;
  }): Promise<void> {
    try {
      await this.prisma.loginAttempt.create({
        data: {
          email: input.email.toLowerCase(),
          ipHash: input.ipHash ?? null,
          userAgent: input.userAgent?.slice(0, 500) ?? null,
          success: input.success,
          userId: input.userId ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(`Không ghi được login attempt: ${(error as Error).message}`);
    }
  }

  /** Đếm số lần đăng nhập thất bại gần đây theo email và theo IP hash. */
  async countRecentFailedLogins(
    email: string,
    ipHash: string | undefined,
    minutes = 15,
  ): Promise<{ byEmail: number; byIp: number }> {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    const [byEmail, byIp] = await Promise.all([
      this.prisma.loginAttempt.count({
        where: { email: email.toLowerCase(), success: false, createdAt: { gte: since } },
      }),
      ipHash
        ? this.prisma.loginAttempt.count({
            where: { ipHash, success: false, createdAt: { gte: since } },
          })
        : Promise.resolve(0),
    ]);

    return { byEmail, byIp };
  }

  async countAll(): Promise<number> {
    return this.prisma.user.count();
  }
}
