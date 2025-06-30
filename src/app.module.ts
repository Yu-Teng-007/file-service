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
    // Configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting
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

    // Static file serving
    ServeStaticModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          rootPath: join(process.cwd(), configService.get('UPLOAD_DIR') || 'uploads'),
          serveRoot: '/uploads',
          serveStaticOptions: {
            maxAge: '1d', // Cache for 1 day
            etag: true,
            lastModified: true,
          },
        },
      ],
      inject: [ConfigService],
    }),

    // Scheduling for background tasks
    ScheduleModule.forRoot(),

    // Feature modules
    FilesModule,
    AuthModule,
    StorageModule,
    CacheModule,
    CDNModule,
    ImageProcessingModule,
    CompressionModule,
    MonitoringModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
