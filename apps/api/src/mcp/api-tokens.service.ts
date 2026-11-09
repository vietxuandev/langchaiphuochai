import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { McpScope } from '@phuochai/shared';
import { PrismaService } from '../prisma/prisma.service';
import { mcpConfig } from './mcp.config';

/** Hình dạng token trả về GraphQL (khớp AgentTokenEntity). */
export interface AgentTokenView {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  agentName: string | null;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  userEmail: string | null;
  userName: string | null;
  /** ACTIVE | EXPIRED | REVOKED */
  status: string;
}

/** Token trả về cho admin **một lần duy nhất** khi tạo. */
export interface CreatedAgentToken {
  token: string;
  record: AgentTokenView;
}

/** Ngữ cảnh xác thực gắn vào mỗi lần gọi tool. */
export interface McpAuthContext {
  tokenId: string;
  tokenName: string;
  agentName: string | null;
  scopes: string[];
  user: { id: string; email: string; name: string; role: string };
  ipHash: string | null;
  userAgent: string | null;
}

const TOKEN_PREFIX = 'phca';

/** sha256(pepper + secret) - token gốc không bao giờ được lưu. */
function hashSecret(secret: string): string {
  return createHash('sha256').update(`${mcpConfig.tokenPepper}:${secret}`).digest('hex');
}

/** So sánh hash theo thời gian hằng số. */
function sameHash(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** Băm IP để không lưu IP thô vào audit log. */
export function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  return createHash('sha256').update(`${mcpConfig.tokenPepper}:${ip}`).digest('hex').slice(0, 32);
}

/**
 * Quản lý token cấp cho AI agent.
 *
 * Định dạng token: `phca_<id>_<secret>`. DB chỉ lưu `id`, `prefix` và hash của secret.
 */
@Injectable()
export class ApiTokensService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tạo token mới, trả về token gốc đúng một lần. */
  async create(input: {
    userId: string;
    name: string;
    agentName?: string | null;
    scopes: McpScope[];
    expiresInDays?: number | null;
  }): Promise<CreatedAgentToken> {
    const id = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    const token = `${TOKEN_PREFIX}_${id}_${secret}`;
    const scopes = [...new Set(input.scopes)];

    if (scopes.length === 0) throw new BadRequestException('Token phải có ít nhất một quyền');

    const expiresAt =
      input.expiresInDays && input.expiresInDays > 0
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

    const record = await this.prisma.apiToken.create({
      data: {
        id,
        userId: input.userId,
        name: input.name.trim(),
        prefix: `${TOKEN_PREFIX}_${id.slice(0, 8)}`,
        secretHash: hashSecret(secret),
        scopes,
        agentName: input.agentName?.trim() || null,
        expiresAt,
      },
      include: { user: { select: { email: true, name: true } } },
    });

    // Trả về đúng hình dạng AgentTokenEntity (status/userEmail được suy ra)
    return { token, record: this.toEntity(record) };
  }

  /** Danh sách token (không trả hash). */
  async list(): Promise<AgentTokenView[]> {
    const rows = await this.prisma.apiToken.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { email: true, name: true } } },
    });

    return rows.map((row) => this.toEntity(row));
  }

  /** Thu hồi token ngay lập tức. */
  async revoke(id: string): Promise<boolean> {
    const token = await this.prisma.apiToken.findUnique({ where: { id }, select: { id: true, revokedAt: true } });
    if (!token) throw new NotFoundException('Không tìm thấy token');
    if (token.revokedAt) return true;

    await this.prisma.apiToken.update({ where: { id }, data: { revokedAt: new Date() } });
    return true;
  }

  /**
   * Xác thực Bearer token.
   * Trả `{ auth }` khi hợp lệ, hoặc `{ reason }` để controller trả 401.
   */
  async verify(rawToken: string | undefined): Promise<{ auth?: McpAuthContext; reason?: string }> {
    if (!rawToken) return { reason: 'Thiếu token (header Authorization: Bearer ...)' };

    // Secret là base64url nên có thể chứa "_": chỉ tách ở 2 dấu gạch đầu tiên
    const value = rawToken.trim();
    const firstSep = value.indexOf('_');
    const secondSep = firstSep >= 0 ? value.indexOf('_', firstSep + 1) : -1;
    if (firstSep < 0 || secondSep < 0 || value.slice(0, firstSep) !== TOKEN_PREFIX) {
      return { reason: 'Token không đúng định dạng' };
    }
    const id = value.slice(firstSep + 1, secondSep);
    const secret = value.slice(secondSep + 1);
    if (!id || !secret) return { reason: 'Token không đúng định dạng' };

    const row = await this.prisma.apiToken.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true, name: true, role: true, isActive: true, status: true } } },
    });
    if (!row) return { reason: 'Token không tồn tại' };
    if (row.revokedAt) return { reason: 'Token đã bị thu hồi' };
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return { reason: 'Token đã hết hạn' };
    if (!row.user.isActive || row.user.status !== 'ACTIVE') return { reason: 'Tài khoản của token không hoạt động' };
    if (!sameHash(row.secretHash, hashSecret(secret))) return { reason: 'Token không hợp lệ' };

    await this.prisma.apiToken.update({ where: { id }, data: { lastUsedAt: new Date() } });

    return {
      auth: {
        tokenId: row.id,
        tokenName: row.name,
        agentName: row.agentName,
        scopes: row.scopes,
        user: { id: row.user.id, email: row.user.email, name: row.user.name, role: row.user.role },
        ipHash: null,
        userAgent: null,
      },
    };
  }

  private toEntity(row: {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    agentName: string | null;
    expiresAt: Date | null;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
    user?: { email: string; name: string } | null;
  }): AgentTokenView {
    return {
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      scopes: row.scopes,
      agentName: row.agentName,
      expiresAt: row.expiresAt,
      lastUsedAt: row.lastUsedAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
      userEmail: row.user?.email ?? null,
      userName: row.user?.name ?? null,
      /** Trạng thái suy ra để giao diện hiển thị. */
      status: row.revokedAt ? 'REVOKED' : row.expiresAt && row.expiresAt.getTime() < Date.now() ? 'EXPIRED' : 'ACTIVE',
    };
  }
}
