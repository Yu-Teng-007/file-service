import { Module, Global } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SecurityService } from './security.service'
import { AccessControlService } from './access-control.service'
import { RateLimitService } from './rate-limit.service'
import { SecurityController } from './security.controller'

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    SecurityService,
    AccessControlService,
    RateLimitService,
  ],
  controllers: [SecurityController],
  exports: [
    SecurityService,
    AccessControlService,
    RateLimitService,
  ],
})
export class SecurityModule {}
