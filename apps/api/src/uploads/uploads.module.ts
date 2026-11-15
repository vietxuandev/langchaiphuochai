import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController, MediaController],
  providers: [UploadsService, MediaService],
  exports: [UploadsService],
})
export class UploadsModule {}
