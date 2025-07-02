import { Module, forwardRef } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { MonitoringService } from './monitoring.service'
import { MonitoringController } from './monitoring.controller'
import { FilesModule } from '../files/files.module'

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot(), forwardRef(() => FilesModule)],
  controllers: [MonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
