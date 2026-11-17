import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';
import type { JwtPayload } from './auth.service';

/** Chiến lược JWT: đọc Bearer token từ header Authorization. */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'phuochai-dev-secret',
    });
  }

  /** Trả về user công khai - object này được gắn vào `req.user`. */
  async validate(payload: JwtPayload) {
    const user = await this.users.findById(payload.sub);
    // Tài khoản chờ duyệt / bị từ chối / bị khoá đều không dùng được token
    if (!user || !user.isActive || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Phiên đăng nhập không còn hiệu lực');
    }
    // Đã đổi mật khẩu sau khi token được cấp -> token cũ (kể cả bị lộ) hết hiệu lực
    if ((payload.ver ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hiệu lực, vui lòng đăng nhập lại');
    }
    return UsersService.toPublic(user);
  }
}
