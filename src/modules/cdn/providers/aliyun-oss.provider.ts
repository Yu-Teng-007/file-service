import { Injectable, Logger } from '@nestjs/common'
import * as OSS from 'ali-oss'
import { stat } from 'fs/promises'
import { CDNProvider, CDNConfig, UploadOptions, UploadResult, PresignedUrlOptions, PresignedUrlResult } from '../interfaces/cdn.interface'

@Injectable()
export class AliyunOSSProvider implements CDNProvider {
  private readonly logger = new Logger(AliyunOSSProvider.name)
  private client: OSS

  constructor(private config: CDNConfig) {
    this.client = new OSS({
      region: config.region!,
      accessKeyId: config.accessKeyId!,
      accessKeySecret: config.accessKeySecret!,
      bucket: config.bucket!,
      endpoint: config.endpoint,
      secure: config.enableHttps !== false,
    })
  }

  async upload(filePath: string, options: UploadOptions): Promise<UploadResult> {
    try {
      const fileStats = await stat(filePath)
      
      const result = await this.client.put(options.key, filePath, {
        headers: {
          'Content-Type': options.contentType,
          ...this.formatMetadata(options.metadata),
        },
        meta: options.metadata,
      })

      const url = this.getPublicUrl(options.key)
      
      this.logger.log(`文件上传成功: ${options.key}`)
      
      return {
        key: options.key,
        url,
        etag: result.etag,
        size: fileStats.size,
        location: result.url,
      }
    } catch (error) {
      this.logger.error(`文件上传失败: ${options.key}`, error)
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.delete(key)
      this.logger.log(`文件删除成功: ${key}`)
    } catch (error) {
      this.logger.error(`文件删除失败: ${key}`, error)
      throw error
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.head(key)
      return true
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        return false
      }
      throw error
    }
  }

  async getFileInfo(key: string): Promise<{
    size: number
    lastModified: Date
    etag: string
    contentType: string
  }> {
    try {
      const result = await this.client.head(key)
      
      return {
        size: parseInt(result.res.headers['content-length']),
        lastModified: new Date(result.res.headers['last-modified']),
        etag: result.res.headers.etag,
        contentType: result.res.headers['content-type'],
      }
    } catch (error) {
      this.logger.error(`获取文件信息失败: ${key}`, error)
      throw error
    }
  }

  async getPresignedUrl(options: PresignedUrlOptions): Promise<PresignedUrlResult> {
    try {
      const expires = options.expires || 3600 // 默认1小时
      
      let url: string
      if (options.operation === 'putObject') {
        url = this.client.signatureUrl(options.key, {
          method: 'PUT',
          expires,
          'Content-Type': options.contentType,
        })
      } else {
        url = this.client.signatureUrl(options.key, {
          method: 'GET',
          expires,
        })
      }
      
      return {
        url,
        expires: new Date(Date.now() + expires * 1000),
      }
    } catch (error) {
      this.logger.error(`生成预签名URL失败: ${options.key}`, error)
      throw error
    }
  }

  async copy(sourceKey: string, targetKey: string): Promise<void> {
    try {
      await this.client.copy(targetKey, sourceKey)
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
      const result = await this.client.list({
        prefix,
        'max-keys': maxKeys,
      })
      
      const files = (result.objects || []).map(obj => ({
        key: obj.name,
        size: obj.size,
        lastModified: new Date(obj.lastModified),
        etag: obj.etag,
      }))

      return {
        files,
        isTruncated: result.isTruncated,
        nextMarker: result.nextMarker,
      }
    } catch (error) {
      this.logger.error(`列出文件失败`, error)
      throw error
    }
  }

  private getPublicUrl(key: string): string {
    if (this.config.customDomain) {
      const protocol = this.config.enableHttps ? 'https' : 'http'
      return `${protocol}://${this.config.customDomain}/${key}`
    }
    
    return this.client.generateObjectUrl(key)
  }

  private formatMetadata(metadata?: Record<string, string>): Record<string, string> {
    if (!metadata) return {}
    
    const formatted: Record<string, string> = {}
    for (const [key, value] of Object.entries(metadata)) {
      formatted[`x-oss-meta-${key}`] = value
    }
    return formatted
  }
}
