import { Injectable, Inject, Logger } from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'

export interface CacheOptions {
  ttl?: number // 生存时间（秒）
  tags?: string[] // 缓存标签，用于批量清理
}

export interface FileMetadataCache {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  category: string
  accessLevel: string
  uploadedAt: Date
  lastAccessed?: Date
  accessCount?: number
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name)

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * 设置缓存
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const ttl = options?.ttl || 3600 // 默认1小时
      await this.cacheManager.set(key, value, ttl)
      
      // 如果有标签，存储标签映射
      if (options?.tags) {
        for (const tag of options.tags) {
          await this.addToTag(tag, key)
        }
      }
      
      this.logger.debug(`缓存已设置: ${key}`)
    } catch (error) {
      this.logger.error(`设置缓存失败: ${key}`, error)
    }
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await this.cacheManager.get<T>(key)
      if (value) {
        this.logger.debug(`缓存命中: ${key}`)
      } else {
        this.logger.debug(`缓存未命中: ${key}`)
      }
      return value
    } catch (error) {
      this.logger.error(`获取缓存失败: ${key}`, error)
      return undefined
    }
  }

  /**
   * 删除缓存
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key)
      this.logger.debug(`缓存已删除: ${key}`)
    } catch (error) {
      this.logger.error(`删除缓存失败: ${key}`, error)
    }
  }

  /**
   * 清空所有缓存
   */
  async reset(): Promise<void> {
    try {
      await this.cacheManager.reset()
      this.logger.debug('所有缓存已清空')
    } catch (error) {
      this.logger.error('清空缓存失败', error)
    }
  }

  /**
   * 缓存文件元数据
   */
  async cacheFileMetadata(fileId: string, metadata: FileMetadataCache, ttl = 3600): Promise<void> {
    const key = this.getFileMetadataKey(fileId)
    await this.set(key, metadata, { ttl, tags: ['file-metadata', `category:${metadata.category}`] })
  }

  /**
   * 获取文件元数据缓存
   */
  async getFileMetadata(fileId: string): Promise<FileMetadataCache | undefined> {
    const key = this.getFileMetadataKey(fileId)
    return this.get<FileMetadataCache>(key)
  }

  /**
   * 删除文件元数据缓存
   */
  async deleteFileMetadata(fileId: string): Promise<void> {
    const key = this.getFileMetadataKey(fileId)
    await this.del(key)
  }

  /**
   * 缓存热点文件列表
   */
  async cacheHotFiles(files: FileMetadataCache[], ttl = 1800): Promise<void> {
    const key = 'hot-files'
    await this.set(key, files, { ttl, tags: ['hot-files'] })
  }

  /**
   * 获取热点文件列表
   */
  async getHotFiles(): Promise<FileMetadataCache[] | undefined> {
    return this.get<FileMetadataCache[]>('hot-files')
  }

  /**
   * 增加文件访问计数
   */
  async incrementFileAccess(fileId: string): Promise<number> {
    const key = this.getFileAccessKey(fileId)
    try {
      const current = await this.get<number>(key) || 0
      const newCount = current + 1
      await this.set(key, newCount, { ttl: 86400 }) // 24小时
      return newCount
    } catch (error) {
      this.logger.error(`增加文件访问计数失败: ${fileId}`, error)
      return 0
    }
  }

  /**
   * 获取文件访问计数
   */
  async getFileAccessCount(fileId: string): Promise<number> {
    const key = this.getFileAccessKey(fileId)
    return (await this.get<number>(key)) || 0
  }

  /**
   * 根据标签清理缓存
   */
  async clearByTag(tag: string): Promise<void> {
    try {
      const tagKey = this.getTagKey(tag)
      const keys = await this.get<string[]>(tagKey)
      if (keys && keys.length > 0) {
        for (const key of keys) {
          await this.del(key)
        }
        await this.del(tagKey)
        this.logger.debug(`已清理标签 ${tag} 的所有缓存`)
      }
    } catch (error) {
      this.logger.error(`清理标签缓存失败: ${tag}`, error)
    }
  }

  /**
   * 添加键到标签
   */
  private async addToTag(tag: string, key: string): Promise<void> {
    const tagKey = this.getTagKey(tag)
    const keys = (await this.get<string[]>(tagKey)) || []
    if (!keys.includes(key)) {
      keys.push(key)
      await this.set(tagKey, keys, { ttl: 86400 }) // 标签映射保存24小时
    }
  }

  /**
   * 生成文件元数据缓存键
   */
  private getFileMetadataKey(fileId: string): string {
    return `file:metadata:${fileId}`
  }

  /**
   * 生成文件访问计数缓存键
   */
  private getFileAccessKey(fileId: string): string {
    return `file:access:${fileId}`
  }

  /**
   * 生成标签缓存键
   */
  private getTagKey(tag: string): string {
    return `tag:${tag}`
  }
}
