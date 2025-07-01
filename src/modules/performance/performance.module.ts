import { Module, Global } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { PerformanceService } from './performance.service'
import { HealthCheckService } from './health-check.service'
import { PerformanceController } from './performance.controller'
import { CacheModule } from '../cache/cache.module'

@Global()
@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    CacheModule,
  ],
  providers: [
    PerformanceService,
    HealthCheckService,
  ],
  controllers: [PerformanceController],
  exports: [
    PerformanceService,
    HealthCheckService,
  ],
})
export class PerformanceModule {}
