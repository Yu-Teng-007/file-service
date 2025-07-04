import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
  Inject,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger'
import { ImageProcessingService } from './image-processing.service'
import { FilesService } from '../files/files.service'
import {
  ImageProcessingOptions,
  ThumbnailOptions,
  ResizeOptions,
  CompressOptions,
  WatermarkOptions,
} from './interfaces/image-processing.interface'

export class ImageProcessDto {
  resize?: ResizeOptions
  compress?: CompressOptions
  watermark?: WatermarkOptions
  format?: 'jpeg' | 'png' | 'webp' | 'avif'
  quality?: number
  stripMetadata?: boolean
}

export class ThumbnailDto {
  sizes: Array<{
    name: string
    width: number
    height?: number
    quality?: number
  }>
  format?: 'jpeg' | 'png' | 'webp'
  progressive?: boolean
}

@ApiTags('image-processing')
@Controller('image-processing')
export class ImageProcessingController {
  constructor(
    private readonly imageProcessingService: ImageProcessingService,
    private readonly filesService: FilesService
  ) {}

  @Post('process')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: '处理图片', description: '对上传的图片进行各种处理操作' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '图片处理请求',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: '要处理的图片文件',
        },
        options: {
          type: 'string',
          description: '处理选项（JSON字符串）',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '图片处理成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            originalSize: { type: 'number' },
            processedSize: { type: 'number' },
            compressionRatio: { type: 'number' },
            processedUrl: { type: 'string' },
            info: {
              type: 'object',
              properties: {
                width: { type: 'number' },
                height: { type: 'number' },
                format: { type: 'string' },
                size: { type: 'number' },
              },
            },
          },
        },
      },
    },
  })
  async processImage(
    @UploadedFile() image: Express.Multer.File,
    @Body('options') optionsStr?: string
  ) {
    if (!image) {
      throw new BadRequestException('请上传图片文件')
    }

    let options: ImageProcessingOptions = {}
    if (optionsStr) {
      try {
        options = JSON.parse(optionsStr)
      } catch (error) {
        throw new BadRequestException('处理选项格式无效')
      }
    }

    const outputPath = `${image.path}.processed`
    const result = await this.imageProcessingService.processImage(image.path, outputPath, options)

    // 生成处理后图片的访问URL
    const fileName = outputPath.split(/[/\\]/).pop() // 支持Windows和Unix路径分隔符
    const processedUrl = `/uploads/temp/image-processing/${fileName}`

    const response = {
      success: true,
      message: '图片处理成功',
      data: {
        originalSize: result.originalSize,
        processedSize: result.processedSize,
        compressionRatio: result.compressionRatio,
        processedUrl,
        info: result.info,
      },
    }

    console.log('图片处理API响应:', JSON.stringify(response, null, 2))
    return response
  }

  @Post('thumbnails')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: '生成缩略图', description: '为上传的图片生成多种尺寸的缩略图' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '缩略图生成请求',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: '要生成缩略图的图片文件',
        },
        options: {
          type: 'string',
          description: '缩略图选项（JSON字符串）',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '缩略图生成成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            thumbnails: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  width: { type: 'number' },
                  height: { type: 'number' },
                  size: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  })
  async generateThumbnails(
    @UploadedFile() image: Express.Multer.File,
    @Body('options') optionsStr: string
  ) {
    if (!image) {
      throw new BadRequestException('请上传图片文件')
    }

    let options: ThumbnailOptions
    try {
      options = JSON.parse(optionsStr)
    } catch (error) {
      throw new BadRequestException('缩略图选项格式无效')
    }

    if (!options.sizes || options.sizes.length === 0) {
      throw new BadRequestException('请指定缩略图尺寸')
    }

    const outputDir = `${image.path}.thumbnails`
    const result = await this.imageProcessingService.generateThumbnails(
      image.path,
      outputDir,
      options
    )

    return {
      success: true,
      message: '缩略图生成成功',
      data: result,
    }
  }

  @Post('compress')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: '压缩图片', description: '压缩上传的图片以减小文件大小' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '图片压缩请求',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: '要压缩的图片文件',
        },
        quality: {
          type: 'number',
          description: '压缩质量 (1-100)',
          minimum: 1,
          maximum: 100,
          default: 80,
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '图片压缩成功',
  })
  async compressImage(@UploadedFile() image: Express.Multer.File, @Body('quality') quality = 80) {
    if (!image) {
      throw new BadRequestException('请上传图片文件')
    }

    const qualityNum = parseInt(quality.toString())
    if (isNaN(qualityNum) || qualityNum < 1 || qualityNum > 100) {
      throw new BadRequestException('压缩质量必须在1-100之间')
    }

    const outputPath = `${image.path}.compressed`
    const result = await this.imageProcessingService.compressImage(
      image.path,
      outputPath,
      qualityNum
    )

    return {
      success: true,
      message: '图片压缩成功',
      data: {
        originalSize: result.originalSize,
        compressedSize: result.processedSize,
        compressionRatio: result.compressionRatio,
        savings: `${(result.compressionRatio * 100).toFixed(2)}%`,
      },
    }
  }

  @Post('resize')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: '调整图片尺寸', description: '调整上传图片的尺寸' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '图片尺寸调整请求',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: '要调整尺寸的图片文件',
        },
        width: {
          type: 'number',
          description: '目标宽度',
        },
        height: {
          type: 'number',
          description: '目标高度（可选）',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '图片尺寸调整成功',
  })
  async resizeImage(
    @UploadedFile() image: Express.Multer.File,
    @Body('width') width: number,
    @Body('height') height?: number
  ) {
    if (!image) {
      throw new BadRequestException('请上传图片文件')
    }

    const widthNum = parseInt(width.toString())
    if (isNaN(widthNum) || widthNum <= 0) {
      throw new BadRequestException('宽度必须是正整数')
    }

    let heightNum: number | undefined
    if (height) {
      heightNum = parseInt(height.toString())
      if (isNaN(heightNum) || heightNum <= 0) {
        throw new BadRequestException('高度必须是正整数')
      }
    }

    const outputPath = `${image.path}.resized`
    const result = await this.imageProcessingService.resizeImage(
      image.path,
      outputPath,
      widthNum,
      heightNum
    )

    return {
      success: true,
      message: '图片尺寸调整成功',
      data: {
        originalSize: { width: result.info.width, height: result.info.height },
        newSize: { width: widthNum, height: heightNum || 'auto' },
        fileSize: result.processedSize,
      },
    }
  }

  @Get('info/:path')
  @ApiOperation({ summary: '获取图片信息', description: '获取指定图片的详细信息' })
  @ApiParam({ name: 'path', description: '图片路径' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取图片信息成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            width: { type: 'number' },
            height: { type: 'number' },
            format: { type: 'string' },
            size: { type: 'number' },
            density: { type: 'number' },
            hasAlpha: { type: 'boolean' },
            channels: { type: 'number' },
            colorspace: { type: 'string' },
          },
        },
      },
    },
  })
  async getImageInfo(@Param('path') imagePath: string) {
    const info = await this.imageProcessingService.getImageInfo(imagePath)

    return {
      success: true,
      message: '获取图片信息成功',
      data: info,
    }
  }

  @Post('save-processed')
  @ApiOperation({ summary: '保存处理后的图片', description: '将处理后的图片保存为新文件' })
  @ApiBody({
    description: '保存处理后图片的请求',
    schema: {
      type: 'object',
      properties: {
        processedUrl: {
          type: 'string',
          description: '处理后图片的URL',
        },
        filename: {
          type: 'string',
          description: '保存的文件名',
        },
        folderId: {
          type: 'string',
          description: '保存到的文件夹ID（可选）',
        },
      },
      required: ['processedUrl', 'filename'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '图片保存成功',
  })
  async saveProcessedImage(
    @Body('processedUrl') processedUrl: string,
    @Body('filename') filename: string,
    @Body('folderId') folderId?: string,
    @Body('overwrite') overwrite?: boolean,
    @Body('originalFileId') originalFileId?: string
  ) {
    if (!processedUrl || !filename) {
      throw new BadRequestException('请提供处理后图片URL和文件名')
    }

    if (overwrite && !originalFileId) {
      throw new BadRequestException('覆盖模式需要提供原始文件ID')
    }

    if (overwrite && originalFileId) {
      // 覆盖模式：更新现有文件
      const fileResult = await this.imageProcessingService.saveProcessedImage(
        processedUrl,
        filename,
        folderId
      )

      // 更新现有文件记录
      const updatedFile = await this.filesService.updateFile(originalFileId, {
        filename: fileResult.originalName,
      })

      return {
        success: true,
        message: '图片覆盖成功',
        data: {
          ...fileResult,
          id: originalFileId,
          overwritten: true,
        },
      }
    } else {
      // 新建模式：创建新文件
      const fileResult = await this.imageProcessingService.saveProcessedImage(
        processedUrl,
        filename,
        folderId
      )

      // 将文件信息添加到数据库
      const fileRecord = await this.filesService.createFileRecord({
        filename: fileResult.filename,
        originalName: fileResult.originalName,
        mimeType: fileResult.mimeType,
        size: fileResult.size,
        path: fileResult.path,
        folderId: folderId || null,
      })

      return {
        success: true,
        message: '图片保存成功',
        data: {
          ...fileResult,
          id: fileRecord.id,
          overwritten: false,
        },
      }
    }
  }
}
