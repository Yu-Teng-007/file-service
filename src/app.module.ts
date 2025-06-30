import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ServeStaticModule } from '@nestjs/serve-static'
import { ThrottlerModule } from '@nestjs/throttler'
import { join } from 'path'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { FilesModule } from './modules/files/files.module'
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

    // Feature modules
    FilesModule,
    AuthModule,
    StorageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
