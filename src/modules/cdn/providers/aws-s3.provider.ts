import { Injectable, Logger } from '@nestjs/common'
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, CopyObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { CDNProvider, CDNConfig, UploadOptions, UploadResult, PresignedUrlOptions, PresignedUrlResult } from '../interfaces/cdn.interface'

@Injectable()
export class AWSS3Provider implements CDNProvider {
  private readonly logger = new Logger(AWSS3Provider.name)
  private s3Client: S3Client
  private bucket: string

  constructor(private config: CDNConfig) {
    this.bucket = config.bucket!
    this.s3Client = new S3Client({
      region: config.region || 'us-east-1',
      credentials: {
        accessKeyId: config.accessKeyId!,
        secretAccessKey: config.accessKeySecret!,
      },
      endpoint: config.endpoint,
    })
  }

  async upload(filePath: string, options: UploadOptions): Promise<UploadResult> {
    try {
      const fileStream = createReadStream(filePath)
      const fileStats = await stat(filePath)

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: options.key,
        Body: fileStream,
        ContentType: options.contentType,
        Metadata: options.metadata,
        ACL: options.acl || 'public-read',
      })

      const result = await this.s3Client.send(command)
      
      const url = this.getPublicUrl(options.key)
      
      this.logger.log(`文件上传成功: ${options.key}`)
      
      return {
        key: options.key,
        url,
        etag: result.ETag,
        size: fileStats.size,
        location: `s3://${this.bucket}/${options.key}`,
      }
    } catch (error) {
      this.logger.error(`文件上传失败: ${options.key}`, error)
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })

      await this.s3Client.send(command)
      this.logger.log(`文件删除成功: ${key}`)
    } catch (error) {
      this.logger.error(`文件删除失败: ${key}`, error)
      throw error
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })

      await this.s3Client.send(command)
      return true
    } catch (error) {
      if (error.name === 'NotFound') {
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
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })

      const result = await this.s3Client.send(command)
      
      return {
        size: result.ContentLength!,
        lastModified: result.LastModified!,
        etag: result.ETag!,
        contentType: result.ContentType!,
      }
    } catch (error) {
      this.logger.error(`获取文件信息失败: ${key}`, error)
      throw error
    }
  }

  async getPresignedUrl(options: PresignedUrlOptions): Promise<PresignedUrlResult> {
    try {
      const expires = options.expires || 3600 // 默认1小时
      
      let command
      if (options.operation === 'putObject') {
        command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: options.key,
          ContentType: options.contentType,
        })
      } else {
        command = new HeadObjectCommand({
          Bucket: this.bucket,
          Key: options.key,
        })
      }

      const url = await getSignedUrl(this.s3Client, command, { expiresIn: expires })
      
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
      const command = new CopyObjectCommand({
        Bucket: this.bucket,
        Key: targetKey,
        CopySource: `${this.bucket}/${sourceKey}`,
      })

      await this.s3Client.send(command)
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
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
      })

      const result = await this.s3Client.send(command)
      
      const files = (result.Contents || []).map(obj => ({
        key: obj.Key!,
        size: obj.Size!,
        lastModified: obj.LastModified!,
        etag: obj.ETag!,
      }))

      return {
        files,
        isTruncated: result.IsTruncated || false,
        nextMarker: result.NextContinuationToken,
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
    return `${protocol}://${this.bucket}.s3.${this.config.region}.amazonaws.com/${key}`
  }
}
