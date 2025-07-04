import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TagsController, FileTagsController } from './tags.controller'
import { TagsService } from './tags.service'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [
    ConfigModule,
    AuthModule,
  ],
  controllers: [TagsController, FileTagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}
