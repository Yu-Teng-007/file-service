import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { FoldersController } from './folders.controller'
import { FoldersService } from './folders.service'
import { FilesModule } from '../files/files.module'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [
    ConfigModule,
    FilesModule,
    AuthModule,
  ],
  controllers: [FoldersController],
  providers: [FoldersService],
  exports: [FoldersService],
})
export class FoldersModule {}
