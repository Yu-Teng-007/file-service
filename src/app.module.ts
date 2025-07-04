import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ServeStaticModule } from '@nestjs/serve-static'
import { ThrottlerModule } from '@nestjs/throttler'
import { ScheduleModule } from '@nestjs/schedule'
import { APP_FILTER } from '@nestjs/core'
import { join } from 'path'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { FilesModule } from './modules/files/files.module'
import { FoldersModule } from './modules/folders/folders.module'
import { TrashModule } from './modules/trash/trash.module'
import { TagsModule } from './modules/tags/tags.module'
import { CacheModule } from './modules/cache/cache.module'
import { CDNModule } from './modules/cdn/cdn.module'
import { ImageProcessingModule } from './modules/image-processing/image-processing.module'
import { CompressionModule } from './modules/compression/compression.module'
import { MonitoringModule } from './modules/monitoring/monitoring.module'
import { AuthModule } from './modules/auth/auth.module'
import { StorageModule } from './modules/storage/storage.module'
import { SecurityModule } from './modules/security/security.module'
import { PerformanceModule } from './modules/performance/performance.module'
import configuration, { validateConfig } from './config/configuration'

// 错误处理相关导入
import { GlobalExceptionFilter } from './common/filters/global-exception.filter'
import { ErrorHandlingMiddleware } from './common/middleware/error-handling.middleware'
import { ErrorRecoveryService } from './common/services/error-recovery.service'

// 安全相关导入
import { SecurityMiddleware } from './modules/security/security.middleware'

// 性能监控相关导入
import { PerformanceMiddleware } from './modules/performance/performance.middleware'

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env.local', '.env'],
      expandVariables: true,
      validate: () => {
        validateConfig()
        return process.env
      },
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
    // 注意：TrashModule 必须在 FilesModule 之前，避免路由冲突
    TrashModule,
    FilesModule,
    FoldersModule,
    TagsModule,
    AuthModule,
    StorageModule,
    CacheModule,
    CDNModule,
    ImageProcessingModule, // 重新启用，使用简化版本
    CompressionModule,
    MonitoringModule,
    SecurityModule,
    PerformanceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ErrorRecoveryService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(PerformanceMiddleware, SecurityMiddleware, ErrorHandlingMiddleware)
      .forRoutes('*')
  }
}
