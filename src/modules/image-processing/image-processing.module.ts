import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MulterModule } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { ImageProcessingService } from './image-processing.service'
import { ImageProcessingController } from './image-processing.controller'
import { FilesModule } from '../files/files.module'

@Module({
  imports: [
    ConfigModule,
    FilesModule,
    MulterModule.register({
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = process.env.UPLOAD_DIR || 'uploads'
          const tempDir = join(uploadDir, 'temp', 'image-processing')
          cb(null, tempDir)
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = uuidv4()
          const ext = extname(file.originalname)
          cb(null, `${uniqueSuffix}${ext}`)
        },
      }),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
        files: 1,
      },
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/svg+xml',
          'image/tiff',
          'image/tif',
          'image/avif',
          'image/bmp',
          'image/x-bmp',
          'image/x-icon',
          'image/vnd.microsoft.icon',
          'image/heic',
          'image/heif',
        ]

        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true)
        } else {
          cb(new Error(`不支持的图片格式: ${file.mimetype}`), false)
        }
      },
    }),
  ],
  controllers: [ImageProcessingController],
  providers: [ImageProcessingService],
  exports: [ImageProcessingService],
})
export class ImageProcessingModule {}
