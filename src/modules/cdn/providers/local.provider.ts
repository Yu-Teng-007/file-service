import { Injectable, Logger } from '@nestjs/common'
import { promises as fs, createReadStream } from 'fs'
import { join, dirname } from 'path'
import { stat, copyFile, readdir } from 'fs/promises'
import { CDNProvider, CDNConfig, UploadOptions, UploadResult, PresignedUrlOptions, PresignedUrlResult } from '../interfaces/cdn.interface'

@Injectable()
export class LocalProvider implements CDNProvider {
  private readonly logger = new Logger(LocalProvider.name)
  private basePath: string
  private baseUrl: string

  constructor(private config: CDNConfig) {
    this.basePath = config.bucket || 'uploads'
    this.baseUrl = config.customDomain || 'http://localhost:3001'
  }

  async upload(filePath: string, options: UploadOptions): Promise<UploadResult> {
    try {
      const targetPath = join(this.basePath, options.key)
      const targetDir = dirname(targetPath)
      
      // 确保目标目录存在
      await fs.mkdir(targetDir, { recursive: true })
      
      // 复制文件
      await copyFile(filePath, targetPath)
      
      const fileStats = await stat(targetPath)
      const url = `${this.baseUrl}/${options.key}`
      
      this.logger.log(`文件上传成功: ${options.key}`)
      
      return {
        key: options.key,
        url,
        size: fileStats.size,
        location: targetPath,
      }
    } catch (error) {
      this.logger.error(`文件上传失败: ${options.key}`, error)
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = join(this.basePath, key)
      await fs.unlink(filePath)
      this.logger.log(`文件删除成功: ${key}`)
    } catch (error) {
      this.logger.error(`文件删除失败: ${key}`, error)
      throw error
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = join(this.basePath, key)
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  async getFileInfo(key: string): Promise<{
    size: number
    lastModified: Date
    etag: string
    contentType: string
  }> {
    try {
      const filePath = join(this.basePath, key)
      const fileStats = await stat(filePath)
      
      // 简单的ETag生成（基于文件大小和修改时间）
      const etag = `"${fileStats.size}-${fileStats.mtime.getTime()}"`
      
      // 简单的Content-Type检测
      const contentType = this.getContentType(key)
      
      return {
        size: fileStats.size,
        lastModified: fileStats.mtime,
        etag,
        contentType,
      }
    } catch (error) {
      this.logger.error(`获取文件信息失败: ${key}`, error)
      throw error
    }
  }

  async getPresignedUrl(options: PresignedUrlOptions): Promise<PresignedUrlResult> {
    // 本地存储不需要预签名URL，直接返回公共URL
    const url = `${this.baseUrl}/${options.key}`
    const expires = new Date(Date.now() + (options.expires || 3600) * 1000)
    
    return {
      url,
      expires,
    }
  }

  async copy(sourceKey: string, targetKey: string): Promise<void> {
    try {
      const sourcePath = join(this.basePath, sourceKey)
      const targetPath = join(this.basePath, targetKey)
      const targetDir = dirname(targetPath)
      
      // 确保目标目录存在
      await fs.mkdir(targetDir, { recursive: true })
      
      await copyFile(sourcePath, targetPath)
      this.logger.log(`文件复制成功: ${sourceKey} -> ${targetKey}`)
    } catch (error) {
      this.logger.error(`文件复制失败: ${sourceKey} -> ${targetKey}`, error)
      throw error
    }
  }

  async list(prefix?: string, maxKeys = 1000): Promise<{
    files: Array<{
      key: string
      size: number
      lastModified: Date
      etag: string
    }>
    isTruncated: boolean
    nextMarker?: string
  }> {
    try {
      const searchPath = prefix ? join(this.basePath, prefix) : this.basePath
      const files: Array<{
        key: string
        size: number
        lastModified: Date
        etag: string
      }> = []

      await this.walkDirectory(searchPath, this.basePath, files, maxKeys)
      
      return {
        files: files.slice(0, maxKeys),
        isTruncated: files.length > maxKeys,
      }
    } catch (error) {
      this.logger.error(`列出文件失败`, error)
      throw error
    }
  }

  private async walkDirectory(
    dirPath: string,
    basePath: string,
    files: Array<{ key: string; size: number; lastModified: Date; etag: string }>,
    maxKeys: number
  ): Promise<void> {
    if (files.length >= maxKeys) return

    try {
      const entries = await readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        if (files.length >= maxKeys) break
        
        const fullPath = join(dirPath, entry.name)
        
        if (entry.isDirectory()) {
          await this.walkDirectory(fullPath, basePath, files, maxKeys)
        } else if (entry.isFile()) {
          const fileStats = await stat(fullPath)
          const relativePath = fullPath.replace(basePath, '').replace(/^[\/\\]/, '')
          const etag = `"${fileStats.size}-${fileStats.mtime.getTime()}"`
          
          files.push({
            key: relativePath.replace(/\\/g, '/'), // 统一使用正斜杠
            size: fileStats.size,
            lastModified: fileStats.mtime,
            etag,
          })
        }
      }
    } catch (error) {
      // 忽略无法访问的目录
      this.logger.warn(`无法访问目录: ${dirPath}`)
    }
  }

  private getContentType(key: string): string {
    const ext = key.split('.').pop()?.toLowerCase()
    
    const mimeTypes: Record<string, string> = {
      // Images
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      
      // Documents
      pdf: 'application/pdf',
      txt: 'text/plain',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      
      // Scripts
      js: 'application/javascript',
      ts: 'application/typescript',
      json: 'application/json',
      
      // Styles
      css: 'text/css',
      scss: 'text/scss',
      less: 'text/less',
      
      // Audio
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      flac: 'audio/flac',
      ogg: 'audio/ogg',
      
      // Video
      mp4: 'video/mp4',
      avi: 'video/x-msvideo',
      mov: 'video/quicktime',
      
      // Archives
      zip: 'application/zip',
      rar: 'application/x-rar-compressed',
      '7z': 'application/x-7z-compressed',
    }
    
    return mimeTypes[ext || ''] || 'application/octet-stream'
  }
}
