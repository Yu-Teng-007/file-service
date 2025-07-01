import { Injectable, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { extname } from 'path'
import * as crypto from 'crypto'
import { promises as fs } from 'fs'
import { fileTypeFromBuffer, type FileTypeResult } from 'file-type'

import {
  FileCategory,
  FileTypeConfig,
  FILE_TYPE_CONFIGS,
  CATEGORY_CONFIGS,
} from '../../types/file.types'

@Injectable()
export class FileValidationService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * 验证文件类型和大小
   */
  async validateFile(file: Express.Multer.File): Promise<{
    category: FileCategory
    config: FileTypeConfig
    isValid: boolean
    errors: string[]
  }> {
    const errors: string[] = []

    // 获取文件扩展名
    const ext = extname(file.originalname).toLowerCase()

    // 查找文件类型配置
    const typeKey = ext.substring(1) // 移除点号
    const config = FILE_TYPE_CONFIGS[typeKey]

    if (!config) {
      errors.push(`不支持的文件类型: ${ext}`)
      return {
        category: FileCategory.TEMP,
        config: null,
        isValid: false,
        errors,
      }
    }

    // 验证文件扩展名
    if (!config.allowedExtensions.includes(ext)) {
      errors.push(`文件扩展名 ${ext} 不在允许列表中`)
    }

    // 验证MIME类型
    if (!config.mimeTypes.includes(file.mimetype)) {
      errors.push(`MIME类型 ${file.mimetype} 不匹配文件扩展名 ${ext}`)
    }

    // 验证文件大小
    if (file.size > config.maxSize) {
      const maxSizeMB = (config.maxSize / (1024 * 1024)).toFixed(2)
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2)
      errors.push(`文件大小 ${fileSizeMB}MB 超过限制 ${maxSizeMB}MB`)
    }

    // 验证文件内容（基础检查）
    try {
      await this.validateFileContent(file, config)
    } catch (error) {
      errors.push(`文件内容验证失败: ${error.message}`)
    }

    return {
      category: config.category,
      config,
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * 验证文件内容
   */
  private async validateFileContent(
    file: Express.Multer.File,
    config: FileTypeConfig
  ): Promise<void> {
    // 读取文件头部字节进行验证
    const buffer = await fs.readFile(file.path)

    // 使用file-type库进行更精确的类型检测
    const fileType = await this.detectFileType(buffer)

    if (fileType && !config.mimeTypes.includes(fileType.mime)) {
      throw new Error(`实际文件类型 ${fileType.mime} 与声明类型不匹配`)
    }

    // 特定类型的额外验证
    switch (config.category) {
      case FileCategory.IMAGE:
        await this.validateImageFile(buffer)
        break
      case FileCategory.SCRIPT:
        await this.validateScriptFile(buffer, file.originalname)
        break
      case FileCategory.DOCUMENT:
        await this.validateDocumentFile(buffer)
        break
    }
  }

  /**
   * 检测文件类型
   */
  private async detectFileType(buffer: Buffer): Promise<FileTypeResult | undefined> {
    try {
      return await fileTypeFromBuffer(buffer)
    } catch (error) {
      // file-type库可能无法识别某些文件类型，这是正常的
      return undefined
    }
  }

  /**
   * 验证图片文件
   */
  private async validateImageFile(buffer: Buffer): Promise<void> {
    // 检查图片文件头
    const imageSignatures = {
      jpeg: [0xff, 0xd8, 0xff],
      png: [0x89, 0x50, 0x4e, 0x47],
      gif: [0x47, 0x49, 0x46],
      webp: [0x52, 0x49, 0x46, 0x46],
    }

    let isValidImage = false
    for (const [type, signature] of Object.entries(imageSignatures)) {
      if (this.checkSignature(buffer, signature)) {
        isValidImage = true
        break
      }
    }

    // SVG文件特殊处理
    if (!isValidImage) {
      const content = buffer.toString('utf8', 0, Math.min(buffer.length, 1000))
      if (content.includes('<svg') || content.includes('<?xml')) {
        isValidImage = true
      }
    }

    if (!isValidImage) {
      throw new Error('无效的图片文件格式')
    }
  }

  /**
   * 验证脚本文件
   */
  private async validateScriptFile(buffer: Buffer, filename: string): Promise<void> {
    const content = buffer.toString('utf8')

    // 检查是否包含恶意代码模式
    const maliciousPatterns = [
      /eval\s*\(/gi,
      /document\.write\s*\(/gi,
      /innerHTML\s*=/gi,
      /<script[^>]*>/gi,
      /javascript:/gi,
    ]

    for (const pattern of maliciousPatterns) {
      if (pattern.test(content)) {
        throw new Error(`检测到潜在的恶意代码模式: ${pattern.source}`)
      }
    }

    // JSON文件特殊验证
    if (filename.endsWith('.json')) {
      try {
        JSON.parse(content)
      } catch (error) {
        throw new Error('无效的JSON格式')
      }
    }
  }

  /**
   * 验证文档文件
   */
  private async validateDocumentFile(buffer: Buffer): Promise<void> {
    // PDF文件验证
    if (this.checkSignature(buffer, [0x25, 0x50, 0x44, 0x46])) {
      // %PDF
      return
    }

    // Office文档验证
    if (this.checkSignature(buffer, [0x50, 0x4b, 0x03, 0x04])) {
      // ZIP signature for modern Office
      return
    }

    // 旧版Office文档
    if (this.checkSignature(buffer, [0xd0, 0xcf, 0x11, 0xe0])) {
      // OLE signature
      return
    }

    // 纯文本文件
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 1000))
    if (this.isValidText(content)) {
      return
    }

    throw new Error('无效的文档文件格式')
  }

  /**
   * 检查文件签名
   */
  private checkSignature(buffer: Buffer, signature: number[]): boolean {
    if (buffer.length < signature.length) {
      return false
    }

    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        return false
      }
    }

    return true
  }

  /**
   * 检查是否为有效文本
   */
  private isValidText(content: string): boolean {
    // 检查是否包含过多的控制字符
    const controlCharCount = (content.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g) || []).length
    const ratio = controlCharCount / content.length

    return ratio < 0.1 // 控制字符比例小于10%认为是文本文件
  }

  /**
   * 计算文件校验和
   */
  async calculateChecksum(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath)
    return crypto.createHash('sha256').update(buffer).digest('hex')
  }

  /**
   * 验证分类限制
   */
  async validateCategoryLimits(
    category: FileCategory,
    currentCount: number,
    currentSize: number,
    newFileSize: number
  ): Promise<void> {
    const config = CATEGORY_CONFIGS[category]

    if (currentCount >= config.maxFiles) {
      throw new BadRequestException(`${category} 分类文件数量已达上限 ${config.maxFiles}`)
    }

    if (currentSize + newFileSize > config.totalSizeLimit) {
      const limitMB = (config.totalSizeLimit / (1024 * 1024)).toFixed(2)
      throw new BadRequestException(`${category} 分类存储空间已达上限 ${limitMB}MB`)
    }
  }

  /**
   * 获取文件类型配置
   */
  getFileTypeConfig(extension: string): FileTypeConfig | null {
    const typeKey = extension.startsWith('.') ? extension.substring(1) : extension
    return FILE_TYPE_CONFIGS[typeKey.toLowerCase()] || null
  }

  /**
   * 获取支持的文件类型列表
   */
  getSupportedFileTypes(): Record<FileCategory, string[]> {
    const result: Record<FileCategory, string[]> = {} as any

    for (const [ext, config] of Object.entries(FILE_TYPE_CONFIGS)) {
      if (!result[config.category]) {
        result[config.category] = []
      }
      result[config.category].push(ext)
    }

    return result
  }

  /**
   * 检查文件名是否安全
   */
  validateFileName(filename: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // 检查文件名长度
    if (filename.length > 255) {
      errors.push('文件名长度不能超过255个字符')
    }

    // 检查非法字符
    const illegalChars = /[<>:"/\\|?*\x00-\x1f]/g
    if (illegalChars.test(filename)) {
      errors.push('文件名包含非法字符')
    }

    // 检查保留名称
    const reservedNames = [
      'CON',
      'PRN',
      'AUX',
      'NUL',
      'COM1',
      'COM2',
      'COM3',
      'COM4',
      'COM5',
      'COM6',
      'COM7',
      'COM8',
      'COM9',
      'LPT1',
      'LPT2',
      'LPT3',
      'LPT4',
      'LPT5',
      'LPT6',
      'LPT7',
      'LPT8',
      'LPT9',
    ]
    const nameWithoutExt = filename.split('.')[0].toUpperCase()
    if (reservedNames.includes(nameWithoutExt)) {
      errors.push('文件名不能使用系统保留名称')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }
}
