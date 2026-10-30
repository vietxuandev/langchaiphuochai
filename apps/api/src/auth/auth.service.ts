import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { LoginInput, RegisterInput } from '@phuochai/shared';
import { Role, UserStatus } from '@prisma/client';
import { UsersService } from '../users/users.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  private async sign(user: { id: string; email: string; role: Role }): Promise<string> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return this.jwt.signAsync(payload);
  }

  async login(input: LoginInput) {
    const user = await this.users.findByEmail(input.email);
    if (!user) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    // Kiểm tra mật khẩu trước để không tiết lộ trạng thái tài khoản cho người lạ
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    if (user.status === UserStatus.PENDING) {
      throw new UnauthorizedException('Tài khoản đang chờ quản trị viên duyệt');
    }
    if (user.status === UserStatus.REJECTED) {
      throw new UnauthorizedException('Yêu cầu đăng ký của bạn đã bị từ chối');
    }
    if (!user.isActive) throw new UnauthorizedException('Tài khoản đã bị vô hiệu hoá');

    await this.users.markLogin(user.id);
    return {
      accessToken: await this.sign(user),
      user: await this.users.getPublicById(user.id),
    };
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
