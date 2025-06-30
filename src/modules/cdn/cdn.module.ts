import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CDNService } from './cdn.service'

@Module({
  imports: [ConfigModule],
  providers: [CDNService],
  exports: [CDNService],
})
export class CDNModule {}
