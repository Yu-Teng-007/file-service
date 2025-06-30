import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CDNProvider, CDNConfig, UploadOptions, UploadResult, PresignedUrlOptions, PresignedUrlResult } from './interfaces/cdn.interface'
import { AWSS3Provider } from './providers/aws-s3.provider'
import { AliyunOSSProvider } from './providers/aliyun-oss.provider'
import { TencentCOSProvider } from './providers/tencent-cos.provider'
import { LocalProvider } from './providers/local.provider'

@Injectable()
export class CDNService {
  private readonly logger = new Logger(CDNService.name)
  private provider: CDNProvider
  private config: CDNConfig

  constructor(private configService: ConfigService) {
    this.config = this.loadConfig()
    this.provider = this.createProvider()
  }

  /**
   * 上传文件到CDN
   */
  async upload(filePath: string, options: UploadOptions): Promise<UploadResult> {
    try {
      this.logger.log(`开始上传文件到CDN: ${options.key}`)
      const result = await this.provider.upload(filePath, options)
      this.logger.log(`文件上传成功: ${options.key} -> ${result.url}`)
      return result
    } catch (error) {
      this.logger.error(`文件上传失败: ${options.key}`, error)
      throw error
    }
  }

  /**
   * 从CDN删除文件
   */
  async delete(key: string): Promise<void> {
    try {
      this.logger.log(`开始从CDN删除文件: ${key}`)
      await this.provider.delete(key)
      this.logger.log(`文件删除成功: ${key}`)
    } catch (error) {
      this.logger.error(`文件删除失败: ${key}`, error)
      throw error
    }
  }

  /**
   * 检查文件是否存在
   */
  async exists(key: string): Promise<boolean> {
    try {
      return await this.provider.exists(key)
    } catch (error) {
      this.logger.error(`检查文件存在性失败: ${key}`, error)
      return false
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(key: string): Promise<{
    size: number
    lastModified: Date
    etag: string
    contentType: string
  }> {
    try {
      return await this.provider.getFileInfo(key)
    } catch (error) {
      this.logger.error(`获取文件信息失败: ${key}`, error)
      throw error
    }
  }

  /**
   * 生成预签名URL
   */
  async getPresignedUrl(options: PresignedUrlOptions): Promise<PresignedUrlResult> {
    try {
      this.logger.log(`生成预签名URL: ${options.key}`)
      const result = await this.provider.getPresignedUrl(options)
      this.logger.log(`预签名URL生成成功: ${options.key}`)
      return result
    } catch (error) {
      this.logger.error(`生成预签名URL失败: ${options.key}`, error)
      throw error
    }
  }

  /**
   * 复制文件
   */
  async copy(sourceKey: string, targetKey: string): Promise<void> {
    try {
      this.logger.log(`开始复制文件: ${sourceKey} -> ${targetKey}`)
      await this.provider.copy(sourceKey, targetKey)
      this.logger.log(`文件复制成功: ${sourceKey} -> ${targetKey}`)
    } catch (error) {
      this.logger.error(`文件复制失败: ${sourceKey} -> ${targetKey}`, error)
      throw error
    }
  }

  /**
   * 列出文件
   */
  async list(prefix?: string, maxKeys?: number): Promise<{
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
      this.logger.log(`列出文件: prefix=${prefix}, maxKeys=${maxKeys}`)
      const result = await this.provider.list(prefix, maxKeys)
      this.logger.log(`列出文件成功: 找到 ${result.files.length} 个文件`)
      return result
    } catch (error) {
      this.logger.error(`列出文件失败`, error)
      throw error
    }
  }

  /**
   * 获取当前CDN配置
   */
  getConfig(): CDNConfig {
    return { ...this.config }
  }

  /**
   * 获取CDN提供商名称
   */
  getProviderName(): string {
    return this.config.provider
  }

  /**
   * 检查CDN服务是否可用
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 尝试列出文件来检查连接
      await this.provider.list('', 1)
      return true
    } catch (error) {
      this.logger.error('CDN健康检查失败', error)
      return false
    }
  }

  /**
   * 加载CDN配置
   */
  private loadConfig(): CDNConfig {
    const provider = this.configService.get<string>('CDN_PROVIDER', 'local') as CDNConfig['provider']
    
    const config: CDNConfig = {
      provider,
      region: this.configService.get<string>('CDN_REGION'),
      bucket: this.configService.get<string>('CDN_BUCKET'),
      accessKeyId: this.configService.get<string>('CDN_ACCESS_KEY_ID'),
      accessKeySecret: this.configService.get<string>('CDN_ACCESS_KEY_SECRET'),
      endpoint: this.configService.get<string>('CDN_ENDPOINT'),
      customDomain: this.configService.get<string>('CDN_CUSTOM_DOMAIN'),
      enableHttps: this.configService.get<boolean>('CDN_ENABLE_HTTPS', true),
    }

    // 验证配置
    this.validateConfig(config)
    
    return config
  }

  /**
   * 验证CDN配置
   */
  private validateConfig(config: CDNConfig): void {
    if (!config.provider) {
      throw new BadRequestException('CDN提供商未配置')
    }

    if (config.provider !== 'local') {
      if (!config.accessKeyId || !config.accessKeySecret) {
        throw new BadRequestException('CDN访问密钥未配置')
      }
      
      if (!config.bucket) {
        throw new BadRequestException('CDN存储桶未配置')
      }
      
      if (!config.region) {
        throw new BadRequestException('CDN区域未配置')
      }
    }
  }

  /**
   * 创建CDN提供商实例
   */
  private createProvider(): CDNProvider {
    switch (this.config.provider) {
      case 'aws':
        return new AWSS3Provider(this.config)
      case 'aliyun':
        return new AliyunOSSProvider(this.config)
      case 'tencent':
        return new TencentCOSProvider(this.config)
      case 'local':
        return new LocalProvider(this.config)
      default:
        throw new BadRequestException(`不支持的CDN提供商: ${this.config.provider}`)
    }
  }
}
