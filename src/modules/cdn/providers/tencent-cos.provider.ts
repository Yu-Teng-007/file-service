import { Injectable, Logger } from '@nestjs/common'
import * as COS from 'cos-nodejs-sdk-v5'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import {
  CDNProvider,
  CDNConfig,
  UploadOptions,
  UploadResult,
  PresignedUrlOptions,
  PresignedUrlResult,
} from '../interfaces/cdn.interface'

@Injectable()
export class TencentCOSProvider implements CDNProvider {
  private readonly logger = new Logger(TencentCOSProvider.name)
  private client: COS
  private bucket: string

  constructor(private config: CDNConfig) {
    this.bucket = config.bucket!
    this.client = new COS({
      SecretId: config.accessKeyId!,
      SecretKey: config.accessKeySecret!,
    })
  }

  async upload(filePath: string, options: UploadOptions): Promise<UploadResult> {
    try {
      const fileStats = await stat(filePath)
      const fileStream = createReadStream(filePath)

      const result = await new Promise<any>((resolve, reject) => {
        this.client.putObject(
          {
            Bucket: this.bucket,
            Region: this.config.region!,
            Key: options.key,
            Body: fileStream,
            ContentType: options.contentType,
          },
          (err, data) => {
            if (err) reject(err)
            else resolve(data)
          }
        )
      })

      const url = this.getPublicUrl(options.key)

      this.logger.log(`文件上传成功: ${options.key}`)

      return {
        key: options.key,
        url,
        etag: result.ETag,
        size: fileStats.size,
        location: result.Location,
      }
    } catch (error) {
      this.logger.error(`文件上传失败: ${options.key}`, error)
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.client.deleteObject(
          {
            Bucket: this.bucket,
            Region: this.config.region!,
            Key: key,
          },
          err => {
            if (err) reject(err)
            else resolve()
          }
        )
      })

      this.logger.log(`文件删除成功: ${key}`)
    } catch (error) {
      this.logger.error(`文件删除失败: ${key}`, error)
      throw error
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await new Promise<any>((resolve, reject) => {
        this.client.headObject(
          {
            Bucket: this.bucket,
            Region: this.config.region!,
            Key: key,
          },
          (err, data) => {
            if (err) reject(err)
            else resolve(data)
          }
        )
      })
      return true
    } catch (error) {
      if (error.statusCode === 404) {
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
      const result = await new Promise<any>((resolve, reject) => {
        this.client.headObject(
          {
            Bucket: this.bucket,
            Region: this.config.region!,
            Key: key,
          },
          (err, data) => {
            if (err) reject(err)
            else resolve(data)
          }
        )
      })

      return {
        size: parseInt(result.headers['content-length']),
        lastModified: new Date(result.headers['last-modified']),
        etag: result.headers.etag,
        contentType: result.headers['content-type'],
      }
    } catch (error) {
      this.logger.error(`获取文件信息失败: ${key}`, error)
      throw error
    }
  }

  async getPresignedUrl(options: PresignedUrlOptions): Promise<PresignedUrlResult> {
    try {
      const expires = options.expires || 3600 // 默认1小时

      const url = await new Promise<string>((resolve, reject) => {
        const method = options.operation === 'putObject' ? 'PUT' : 'GET'

        this.client.getObjectUrl(
          {
            Bucket: this.bucket,
            Region: this.config.region!,
            Key: options.key,
            Sign: true,
            Method: method,
            Expires: expires,
          },
          (err, data) => {
            if (err) reject(err)
            else resolve(data.Url)
          }
        )
      })

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
      await new Promise<void>((resolve, reject) => {
        this.client.putObjectCopy(
          {
            Bucket: this.bucket,
            Region: this.config.region!,
            Key: targetKey,
            CopySource: `${this.bucket}.cos.${this.config.region}.myqcloud.com/${sourceKey}`,
          },
          err => {
            if (err) reject(err)
            else resolve()
          }
        )
      })

      this.logger.log(`文件复制成功: ${sourceKey} -> ${targetKey}`)
    } catch (error) {
      this.logger.error(`文件复制失败: ${sourceKey} -> ${targetKey}`, error)
      throw error
    }
  }

  async list(
    prefix?: string,
    maxKeys = 1000
  ): Promise<{
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
      const result = await new Promise<any>((resolve, reject) => {
        this.client.getBucket(
          {
            Bucket: this.bucket,
            Region: this.config.region!,
            Prefix: prefix,
            MaxKeys: maxKeys,
          },
          (err, data) => {
            if (err) reject(err)
            else resolve(data)
          }
        )
      })

      const files = (result.Contents || []).map((obj: any) => ({
        key: obj.Key,
        size: parseInt(obj.Size),
        lastModified: new Date(obj.LastModified),
        etag: obj.ETag,
      }))

      return {
        files,
        isTruncated: result.IsTruncated === 'true',
        nextMarker: result.NextMarker,
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

    const protocol = this.config.enableHttps ? 'https' : 'http'
    return `${protocol}://${this.bucket}.cos.${this.config.region}.myqcloud.com/${key}`
  }
}
