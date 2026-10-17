import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { LoginInput, RegisterInput } from '@phuochai/shared';
import { Role } from '@prisma/client';
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
    if (!user.isActive) throw new UnauthorizedException('Tài khoản đã bị vô hiệu hoá');

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    await this.users.markLogin(user.id);
    return {
      accessToken: await this.sign(user),
      user: await this.users.getPublicById(user.id),
    };
  }

  async register(input: RegisterInput) {
    const user = await this.users.create({
      name: input.name,
      email: input.email,
      password: input.password,
      role: Role.USER,
    });
    return {
      accessToken: await this.sign({ id: user.id, email: user.email, role: user.role }),
      user,
    };
  }

  async me(userId: string) {
    return this.users.getPublicById(userId);
  }
}
