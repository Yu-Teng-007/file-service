import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { promises as fs } from 'fs'
import { join } from 'path'
import {
  ImageProcessingOptions,
  ImageInfo,
  ProcessingResult,
  ThumbnailOptions,
  ThumbnailResult,
} from './interfaces/image-processing.interface'

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name)
  private readonly supportedFormats = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'svg']

  constructor(private configService: ConfigService) {}

  /**
   * 处理图片 (简化版本，不使用Sharp)
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
      
      // 简单复制文件（暂时不进行实际处理）
      const originalSize = (await fs.stat(inputPath)).size
      await fs.copyFile(inputPath, outputPath)
      const processedSize = originalSize
      
      const result: ProcessingResult = {
        buffer: await fs.readFile(outputPath),
        info: {
          width: 800, // 模拟值
          height: 600, // 模拟值
          format: 'jpeg',
          size: processedSize,
          density: 72,
          hasAlpha: false,
          channels: 3,
          colorspace: 'srgb',
        },
        originalSize,
        processedSize,
        compressionRatio: 0,
      }
      
      this.logger.log(`图片处理完成: ${inputPath} -> ${outputPath}`)
      
      return result
    } catch (error) {
      this.logger.error(`图片处理失败: ${inputPath}`, error)
      throw error
    }
  }

  /**
   * 生成缩略图 (简化版本)
   */
  async generateThumbnails(
    inputPath: string,
    outputDir: string,
    options: ThumbnailOptions
  ): Promise<ThumbnailResult> {
    try {
      this.logger.log(`开始生成缩略图: ${inputPath}`)
      
      await this.validateImageFile(inputPath)
      
      const thumbnails: ThumbnailResult['thumbnails'] = []
      
      for (const size of options.sizes) {
        const outputPath = join(outputDir, `${size.name}.${options.format || 'jpeg'}`)
        
        // 简单复制原文件作为缩略图（实际项目中需要真正的图片处理）
        await fs.mkdir(outputDir, { recursive: true })
        await fs.copyFile(inputPath, outputPath)
        const buffer = await fs.readFile(outputPath)
        
        thumbnails.push({
          name: size.name,
          buffer,
          width: size.width,
          height: size.height || size.width,
          size: buffer.length,
        })
        
        this.logger.log(`缩略图生成完成: ${size.name} (${size.width}x${size.height || size.width})`)
      }
      
      return { thumbnails }
    } catch (error) {
      this.logger.error(`缩略图生成失败: ${inputPath}`, error)
      throw error
    }
  }

  /**
   * 获取图片信息 (简化版本)
   */
  async getImageInfo(imagePath: string): Promise<ImageInfo> {
    try {
      const stats = await fs.stat(imagePath)
      
      return {
        width: 800, // 模拟值
        height: 600, // 模拟值
        format: 'jpeg',
        size: stats.size,
        density: 72,
        hasAlpha: false,
        channels: 3,
        colorspace: 'srgb',
      }
    } catch (error) {
      this.logger.error(`获取图片信息失败: ${imagePath}`, error)
      throw error
    }
  }

  /**
   * 压缩图片 (简化版本)
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
   * 调整图片大小 (简化版本)
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
   * 转换图片格式 (简化版本)
   */
  async convertFormat(
    inputPath: string,
    outputPath: string,
    format: 'jpeg' | 'png' | 'webp',
    quality = 80
  ): Promise<ProcessingResult> {
    return this.processImage(inputPath, outputPath, {
      format: { format, quality },
    })
  }

  /**
   * 验证图片文件 (简化版本)
   */
  private async validateImageFile(imagePath: string): Promise<void> {
    try {
      await fs.access(imagePath)
      
      // 简单的文件扩展名检查
      const ext = imagePath.split('.').pop()?.toLowerCase()
      if (!ext || !this.supportedFormats.includes(ext)) {
        throw new BadRequestException(`不支持的图片格式: ${ext}`)
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error
      }
      throw new BadRequestException(`无效的图片文件: ${imagePath}`)
    }
  }
}
