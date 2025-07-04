import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TrashController } from './trash.controller'
import { TrashService } from './trash.service'
import { FilesModule } from '../files/files.module'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [
    ConfigModule,
    FilesModule,
    AuthModule,
  ],
  controllers: [TrashController],
  providers: [TrashService],
  exports: [TrashService],
})
export class TrashModule {}
