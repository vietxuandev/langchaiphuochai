import { Controller, Delete, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@phuochai/shared';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards';
import { MediaService, type MediaPage } from './media.service';

/** API thư viện ảnh cho khu vực quản trị. */
@Controller('api/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.EDITOR)
  @Get()
  async list(
    @Query('query') query?: string,
    @Query('folder') folder?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<MediaPage> {
    return this.media.list({
      query,
      folder,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  /** Chỉ xoá ảnh chưa được bài viết/danh mục/người dùng sử dụng. */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.EDITOR)
  @Delete()
  async remove(@Query('path') path: string): Promise<{ ok: boolean }> {
    return { ok: await this.media.remove(path) };
  }
}
