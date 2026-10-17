import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { UsersModule } from '../users/users.module';
import { PostsResolver } from './posts.resolver';
import { PostsService } from './posts.service';

@Module({
  imports: [CategoriesModule, UsersModule],
  providers: [PostsService, PostsResolver],
  exports: [PostsService],
})
export class PostsModule {}
