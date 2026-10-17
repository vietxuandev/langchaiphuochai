import {
  BadRequestException,
  Controller,
  Delete,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role, UPLOAD } from '@phuochai/shared';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards';
import { UploadsService, type UploadResult } from './uploads.service';

interface RequestWithUser {
  user?: { id: string; role: string };
}

/**
 * API upload ảnh (REST, multipart/form-data).
 *
 *   POST   /api/upload?folder=posts      (field: "file") - yêu cầu đăng nhập
 *   DELETE /api/upload?path=/upload/...  - yêu cầu vai trò EDITOR trở lên
 *
 * Ảnh được lưu trong thư mục `upload/` của server mới và phục vụ tại `/upload/...`.
 */
@Controller('api/upload')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: UPLOAD.maxBytes, files: 1 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('folder') folder = UPLOAD.postsFolder,
    @Req() _request: RequestWithUser,
  ): Promise<UploadResult> {
    if (!file) throw new BadRequestException('Chưa chọn file ảnh');
    return this.uploads.save(
      {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      },
      folder,
    );
  }

  /** Xoá ảnh không còn dùng (chỉ admin/editor). */
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.EDITOR)
  @Delete()
  async remove(@Query('path') path: string): Promise<{ ok: boolean }> {
    const ok = await this.uploads.remove(path);
    return { ok };
  }
}
