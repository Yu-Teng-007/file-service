import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MulterModule } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { CompressionService } from './compression.service'
import { CompressionController } from './compression.controller'

@Module({
  imports: [
    ConfigModule,
    MulterModule.register({
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = process.env.UPLOAD_DIR || 'uploads'
          const tempDir = join(uploadDir, 'temp', 'compression')
          cb(null, tempDir)
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = uuidv4()
          const ext = extname(file.originalname)
          cb(null, `${uniqueSuffix}${ext}`)
        },
      }),
      limits: {
        fileSize: 500 * 1024 * 1024, // 500MB
        files: 50, // 最多50个文件
      },
      fileFilter: (req, file, cb) => {
        // 允许所有文件类型进行压缩
        cb(null, true)
      },
    }),
  ],
  controllers: [CompressionController],
  providers: [CompressionService],
  exports: [CompressionService],
})
export class CompressionModule {}
