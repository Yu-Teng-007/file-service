import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { v4 as uuidv4 } from 'uuid'

import { FilesController } from './files.controller'
import { FilesService } from './files.service'
import { FileValidationService } from './file-validation.service'
import { FileStorageService } from './file-storage.service'
import { StorageModule } from '../storage/storage.module'
import { CacheModule } from '../cache/cache.module'
import { CDNModule } from '../cdn/cdn.module'

@Module({
  imports: [
    ConfigModule,
    StorageModule,
    CacheModule,
    CDNModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        storage: diskStorage({
          destination: (req, file, cb) => {
            const uploadDir = configService.get<string>('UPLOAD_DIR') || 'uploads'
            const tempDir = join(uploadDir, 'temp')
            cb(null, tempDir)
          },
          filename: (req, file, cb) => {
            const uniqueSuffix = uuidv4()
            const ext = extname(file.originalname)
            cb(null, `${uniqueSuffix}${ext}`)
          },
        }),
        limits: {
          fileSize: parseInt(configService.get<string>('MAX_FILE_SIZE') || '104857600'), // 100MB default
          files: 10, // Maximum 10 files per request
        },
        fileFilter: (req, file, cb) => {
          // Basic file filter - detailed validation in service
          const allowedMimes = [
            // Images
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/svg+xml',
            // Scripts
            'application/javascript',
            'text/javascript',
            'application/typescript',
            'application/json',
            // Styles
            'text/css',
            'text/scss',
            'text/less',
            // Fonts
            'font/ttf',
            'font/woff',
            'font/woff2',
            'application/vnd.ms-fontobject',
            // Documents
            'application/pdf',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            // Music
            'audio/mpeg',
            'audio/mp3',
            'audio/wav',
            'audio/flac',
            'audio/ogg',
            // Videos
            'video/mp4',
            'video/avi',
            'video/mov',
            'video/wmv',
            // Archives
            'application/zip',
            'application/x-rar-compressed',
            'application/x-7z-compressed',
          ]

          if (allowedMimes.includes(file.mimetype)) {
            cb(null, true)
          } else {
            cb(new Error(`不支持的文件类型: ${file.mimetype}`), false)
          }
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService, FileValidationService, FileStorageService],
  exports: [FilesService],
})
export class FilesModule {}
