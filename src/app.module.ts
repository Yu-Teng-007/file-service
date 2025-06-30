import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ServeStaticModule } from '@nestjs/serve-static'
import { ThrottlerModule } from '@nestjs/throttler'
import { ScheduleModule } from '@nestjs/schedule'
import { join } from 'path'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { FilesModule } from './modules/files/files.module'
import { CacheModule } from './modules/cache/cache.module'
import { CDNModule } from './modules/cdn/cdn.module'
import { ImageProcessingModule } from './modules/image-processing/image-processing.module'
import { CompressionModule } from './modules/compression/compression.module'
import { MonitoringModule } from './modules/monitoring/monitoring.module'
import { AuthModule } from './modules/auth/auth.module'
import { StorageModule } from './modules/storage/storage.module'

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // 速率限制
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          ttl: parseInt(configService.get('RATE_LIMIT_TTL') || '60') * 1000,
          limit: parseInt(configService.get('RATE_LIMIT_LIMIT') || '100'),
        },
      ],
      inject: [ConfigService],
    }),

    // 静态文件服务
    ServeStaticModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          rootPath: join(process.cwd(), configService.get('UPLOAD_DIR') || 'uploads'),
          serveRoot: '/uploads',
          serveStaticOptions: {
            maxAge: '1d', // 缓存1天
            etag: true,
            lastModified: true,
          },
        },
      ],
      inject: [ConfigService],
    }),

    // 后台任务调度
    ScheduleModule.forRoot(),

    // 功能模块
    FilesModule,
    AuthModule,
    StorageModule,
    CacheModule,
    CDNModule,
    ImageProcessingModule, // 重新启用，使用简化版本
    CompressionModule,
    MonitoringModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
