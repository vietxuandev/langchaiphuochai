import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, type User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import type { AdminCreateUserInput, UpdateUserInput } from '@phuochai/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface UserListFilter {
  keyword?: string;
  role?: Role;
  isActive?: boolean;
  page: number;
  pageSize: number;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
      },
    });
    return UsersService.toPublic(user);
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

  async countAll(): Promise<number> {
    return this.prisma.user.count();
  }
}
