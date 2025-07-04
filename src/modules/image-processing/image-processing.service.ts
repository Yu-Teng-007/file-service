import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as sharp from 'sharp'
import { promises as fs } from 'fs'
import { join, extname, basename } from 'path'
import {
  ImageProcessingOptions,
  ImageInfo,
  ProcessingResult,
  ThumbnailOptions,
  ThumbnailResult,
  ResizeOptions,
  CompressOptions,
  FormatOptions,
  FilterOptions,
} from './interfaces/image-processing.interface'

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name)
  private readonly supportedFormats = [
    'jpeg',
    'jpg',
    'png',
    'webp',
    'avif',
    'tiff',
    'tif',
    'gif',
    'bmp',
    'ico',
    'heic',
    'heif',
  ]

  constructor(private configService: ConfigService) {}

  /**
   * 处理图片
   */
  async processImage(
    inputPath: string,
    outputPath: string,
    options: ImageProcessingOptions = {}
  ): Promise<ProcessingResult> {
    try {
      this.logger.log(`开始处理图片: ${inputPath}`)

      // 验证输入文件
      await this.validateImageFile(inputPath)

      // 获取原始图片信息
      const originalSize = (await fs.stat(inputPath)).size

      // 创建Sharp实例
      let pipeline = sharp(inputPath)

      // 应用各种处理选项
      pipeline = this.applyProcessingOptions(pipeline, options)

      // 处理并保存
      const buffer = await pipeline.toBuffer()
      await fs.writeFile(outputPath, buffer)

      // 获取处理后的图片信息
      const processedInfo = await sharp(buffer).metadata()
      const processedSize = buffer.length

      const result: ProcessingResult = {
        buffer,
        info: {
          width: processedInfo.width!,
          height: processedInfo.height!,
          format: processedInfo.format!,
          size: processedSize,
          density: processedInfo.density,
          hasAlpha: processedInfo.hasAlpha,
          channels: processedInfo.channels!,
          colorspace: processedInfo.space!,
        },
        originalSize,
        processedSize,
        compressionRatio: originalSize > 0 ? (originalSize - processedSize) / originalSize : 0,
      }

      this.logger.log(`图片处理完成: ${inputPath} -> ${outputPath}`)
      this.logger.log(`压缩比: ${(result.compressionRatio * 100).toFixed(2)}%`)

      return result
    } catch (error) {
      this.logger.error(`图片处理失败: ${inputPath}`, error)
      throw error
    }
  }

  /**
   * 生成缩略图
   */
  async generateThumbnails(
    inputPath: string,
    outputDir: string,
    options: ThumbnailOptions
  ): Promise<ThumbnailResult> {
    try {
      this.logger.log(`开始生成缩略图: ${inputPath}`)

      await this.validateImageFile(inputPath)
      await fs.mkdir(outputDir, { recursive: true })

      const thumbnails: ThumbnailResult['thumbnails'] = []

      for (const size of options.sizes) {
        const outputPath = join(outputDir, `${size.name}.${options.format || 'jpeg'}`)

        let pipeline = sharp(inputPath).resize(size.width, size.height, {
          fit: 'cover',
          position: 'center',
        })

        // 设置格式和质量
        if (options.format === 'jpeg') {
          pipeline = pipeline.jpeg({
            quality: size.quality || 80,
            progressive: options.progressive,
          })
        } else if (options.format === 'png') {
          pipeline = pipeline.png({
            quality: size.quality || 80,
            progressive: options.progressive,
          })
        } else if (options.format === 'webp') {
          pipeline = pipeline.webp({
            quality: size.quality || 80,
          })
        }

        const buffer = await pipeline.toBuffer()
        await fs.writeFile(outputPath, buffer)

        const metadata = await sharp(buffer).metadata()

        thumbnails.push({
          name: size.name,
          buffer,
          width: metadata.width!,
          height: metadata.height!,
          size: buffer.length,
        })

        this.logger.log(`缩略图生成完成: ${size.name} (${metadata.width}x${metadata.height})`)
      }

      return { thumbnails }
    } catch (error) {
      this.logger.error(`缩略图生成失败: ${inputPath}`, error)
      throw error
    }
  }

  /**
   * 获取图片信息
   */
  async getImageInfo(imagePath: string): Promise<ImageInfo> {
    try {
      const metadata = await sharp(imagePath).metadata()
      const stats = await fs.stat(imagePath)

      return {
        width: metadata.width!,
        height: metadata.height!,
        format: metadata.format!,
        size: stats.size,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        channels: metadata.channels!,
        colorspace: metadata.space!,
      }
    } catch (error) {
      this.logger.error(`获取图片信息失败: ${imagePath}`, error)
      throw error
    }
  }

  /**
   * 压缩图片
   */
  async compressImage(
    inputPath: string,
    outputPath: string,
    quality = 80
  ): Promise<ProcessingResult> {
    return this.processImage(inputPath, outputPath, {
      compress: { quality },
      stripMetadata: true,
    })
  }

  /**
   * 调整图片大小
   */
  async resizeImage(
    inputPath: string,
    outputPath: string,
    width: number,
    height?: number
  ): Promise<ProcessingResult> {
    return this.processImage(inputPath, outputPath, {
      resize: { width, height, fit: 'inside' },
    })
  }

  /**
   * 转换图片格式
   */
  async convertFormat(
    inputPath: string,
    outputPath: string,
    format: 'jpeg' | 'png' | 'webp' | 'avif',
    quality = 80
  ): Promise<ProcessingResult> {
    return this.processImage(inputPath, outputPath, {
      format: { format, quality },
    })
  }

  /**
   * 验证图片文件
   */
  private async validateImageFile(imagePath: string): Promise<void> {
    try {
      await fs.access(imagePath)
      const metadata = await sharp(imagePath).metadata()

      if (!metadata.format || !this.supportedFormats.includes(metadata.format)) {
        throw new BadRequestException(`不支持的图片格式: ${metadata.format}`)
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error
      }
      throw new BadRequestException(`无效的图片文件: ${imagePath}`)
    }
  }

  /**
   * 应用处理选项
   */
  private applyProcessingOptions(
    pipeline: sharp.Sharp,
    options: ImageProcessingOptions
  ): sharp.Sharp {
    // 裁剪
    if (options.crop) {
      pipeline = pipeline.extract({
        left: options.crop.left,
        top: options.crop.top,
        width: options.crop.width,
        height: options.crop.height,
      })
    }

    // 旋转
    if (options.rotate) {
      pipeline = pipeline.rotate(options.rotate.angle, {
        background: options.rotate.background || 'white',
      })
    }

    // 调整大小
    if (options.resize) {
      pipeline = pipeline.resize(options.resize.width, options.resize.height, {
        fit: options.resize.fit || 'inside',
        position: options.resize.position,
        background: options.resize.background,
        withoutEnlargement: options.resize.withoutEnlargement,
        withoutReduction: options.resize.withoutReduction,
      })
    }

    // 滤镜效果
    if (options.filter) {
      pipeline = this.applyFilters(pipeline, options.filter)
    }

    // 格式转换
    if (options.format) {
      pipeline = this.applyFormat(pipeline, options.format)
    } else if (options.compress) {
      pipeline = this.applyCompression(pipeline, options.compress)
    }

    // 移除元数据
    if (options.stripMetadata) {
      pipeline = pipeline.withMetadata({})
    }

    return pipeline
  }

  /**
   * 应用滤镜效果
   */
  private applyFilters(pipeline: sharp.Sharp, filters: FilterOptions): sharp.Sharp {
    if (filters.blur) {
      pipeline = pipeline.blur(filters.blur)
    }

    if (filters.sharpen) {
      pipeline = pipeline.sharpen(filters.sharpen)
    }

    if (filters.brightness !== undefined) {
      pipeline = pipeline.modulate({ brightness: 1 + filters.brightness })
    }

    if (filters.saturation !== undefined) {
      pipeline = pipeline.modulate({ saturation: 1 + filters.saturation })
    }

    if (filters.hue !== undefined) {
      pipeline = pipeline.modulate({ hue: filters.hue })
    }

    if (filters.gamma) {
      pipeline = pipeline.gamma(filters.gamma)
    }

    if (filters.negate) {
      pipeline = pipeline.negate()
    }

    if (filters.grayscale) {
      pipeline = pipeline.grayscale()
    }

    return pipeline
  }

  /**
   * 应用格式转换
   */
  private applyFormat(pipeline: sharp.Sharp, format: FormatOptions): sharp.Sharp {
    switch (format.format) {
      case 'jpeg':
        return pipeline.jpeg({
          quality: format.quality || 80,
          progressive: format.progressive,
        })
      case 'png':
        return pipeline.png({
          quality: format.quality || 80,
          progressive: format.progressive,
        })
      case 'webp':
        return pipeline.webp({
          quality: format.quality || 80,
          lossless: format.lossless,
          effort: format.effort || 4,
        })
      case 'avif':
        return pipeline.avif({
          quality: format.quality || 80,
          effort: format.effort || 4,
        })
      default:
        return pipeline
    }
  }

  /**
   * 应用压缩
   */
  private applyCompression(pipeline: sharp.Sharp, compress: CompressOptions): sharp.Sharp {
    return pipeline.jpeg({
      quality: compress.quality || 80,
      progressive: compress.progressive,
      mozjpeg: compress.mozjpeg,
    })
  }

  /**
   * 保存处理后的图片
   */
  async saveProcessedImage(
    processedUrl: string,
    filename: string,
    folderId?: string
  ): Promise<{ fileId: string; url: string }> {
    try {
      this.logger.log(`开始保存处理后的图片: ${processedUrl}`)

      // 从URL中提取文件路径
      const urlPath = processedUrl.replace('/uploads/temp/image-processing/', '')
      const tempPath = join(
        this.configService.get('UPLOAD_DIR') || 'uploads',
        'temp',
        'image-processing',
        urlPath
      )

      // 验证临时文件是否存在
      await fs.access(tempPath)

      // 生成新的文件路径
      const uploadDir = this.configService.get('UPLOAD_DIR') || 'uploads'
      const targetDir = folderId ? join(uploadDir, 'images', folderId) : join(uploadDir, 'images')
      await fs.mkdir(targetDir, { recursive: true })

      // 生成唯一文件名
      const ext = extname(filename) || '.jpg'
      const baseName = basename(filename, ext)
      const uniqueFilename = `${baseName}_${Date.now()}${ext}`
      const targetPath = join(targetDir, uniqueFilename)

      // 复制文件到目标位置
      await fs.copyFile(tempPath, targetPath)

      // 生成访问URL
      const fileUrl = `/uploads/images/${folderId ? folderId + '/' : ''}${uniqueFilename}`

      // 清理临时文件
      try {
        await fs.unlink(tempPath)
      } catch (error) {
        this.logger.warn(`清理临时文件失败: ${tempPath}`, error)
      }

      this.logger.log(`图片保存成功: ${targetPath}`)

      return {
        fileId: uniqueFilename.replace(ext, ''),
        url: fileUrl,
      }
    } catch (error) {
      this.logger.error(`保存处理后图片失败: ${processedUrl}`, error)
      throw new BadRequestException('保存图片失败')
    }
  }
}
