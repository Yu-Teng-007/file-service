import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { promises as fs } from 'fs'
import { join, dirname, extname } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { createHash } from 'crypto'
import {
  FileVersion,
  VersionHistory,
  VersionDiff,
  VersioningConfig,
  CreateVersionOptions,
  RestoreOptions,
  VersionSearchQuery,
  VersionStats,
  BranchInfo,
  MergeOptions,
  VersioningEvent,
} from './interfaces/versioning.interface'

@Injectable()
export class VersioningService {
  private readonly logger = new Logger(VersioningService.name)
  private versions = new Map<string, FileVersion[]>() // fileId -> versions
  private branches = new Map<string, BranchInfo[]>() // fileId -> branches
  private events: VersioningEvent[] = []
  private config: VersioningConfig

  constructor(private configService: ConfigService) {
    this.config = this.loadConfig()
  }

  /**
   * 创建文件版本
   */
  async createVersion(
    fileId: string,
    filePath: string,
    options: CreateVersionOptions = {}
  ): Promise<FileVersion> {
    try {
      this.logger.log(`创建文件版本: ${fileId}`)

      // 检查文件是否存在
      const stats = await fs.stat(filePath)
      const checksum = await this.calculateChecksum(filePath)

      // 获取现有版本
      const existingVersions = this.versions.get(fileId) || []
      
      // 检查是否有相同内容的版本
      const duplicateVersion = existingVersions.find(v => v.checksum === checksum)
      if (duplicateVersion && !options.preserveOriginal) {
        this.logger.warn(`文件内容未变化，跳过版本创建: ${fileId}`)
        return duplicateVersion
      }

      // 计算新版本号
      const newVersionNumber = existingVersions.length > 0 
        ? Math.max(...existingVersions.map(v => v.version)) + 1 
        : 1

      // 创建版本存储路径
      const versionStoragePath = await this.createVersionStoragePath(fileId, newVersionNumber)
      
      // 复制文件到版本存储位置
      await fs.copyFile(filePath, versionStoragePath)

      // 创建版本记录
      const version: FileVersion = {
        id: uuidv4(),
        fileId,
        version: newVersionNumber,
        fileName: filePath.split('/').pop() || 'unknown',
        filePath: versionStoragePath,
        size: stats.size,
        mimeType: this.getMimeType(filePath),
        checksum,
        createdAt: new Date(),
        createdBy: options.createdBy,
        comment: options.comment,
        tags: options.tags || [],
        metadata: options.metadata,
        isActive: true,
        parentVersionId: existingVersions.length > 0 ? existingVersions[existingVersions.length - 1].id : undefined,
      }

      // 将旧版本标记为非活跃
      existingVersions.forEach(v => v.isActive = false)

      // 添加新版本
      existingVersions.push(version)
      this.versions.set(fileId, existingVersions)

      // 记录事件
      await this.recordEvent({
        type: 'create',
        fileId,
        versionId: version.id,
        userId: options.createdBy,
        details: {
          version: newVersionNumber,
          comment: options.comment,
          tags: options.tags,
        },
      })

      // 清理旧版本（如果超过限制）
      await this.cleanupOldVersions(fileId)

      this.logger.log(`文件版本创建成功: ${fileId} v${newVersionNumber}`)
      return version
    } catch (error) {
      this.logger.error(`创建文件版本失败: ${fileId}`, error)
      throw error
    }
  }

  /**
   * 获取文件版本历史
   */
  async getVersionHistory(fileId: string): Promise<VersionHistory> {
    const versions = this.versions.get(fileId) || []
    
    if (versions.length === 0) {
      throw new NotFoundException(`文件版本历史不存在: ${fileId}`)
    }

    const sortedVersions = versions.sort((a, b) => b.version - a.version)
    const currentVersion = sortedVersions.find(v => v.isActive)?.version || 0
    const totalSize = versions.reduce((sum, v) => sum + v.size, 0)

    return {
      fileId,
      fileName: versions[0].fileName,
      currentVersion,
      totalVersions: versions.length,
      versions: sortedVersions,
      totalSize,
      createdAt: versions[0].createdAt,
      lastModified: sortedVersions[0].createdAt,
    }
  }

  /**
   * 获取特定版本
   */
  async getVersion(fileId: string, version: number): Promise<FileVersion> {
    const versions = this.versions.get(fileId) || []
    const targetVersion = versions.find(v => v.version === version)
    
    if (!targetVersion) {
      throw new NotFoundException(`版本不存在: ${fileId} v${version}`)
    }

    return targetVersion
  }

  /**
   * 恢复到指定版本
   */
  async restoreVersion(
    fileId: string,
    targetPath: string,
    options: RestoreOptions
  ): Promise<FileVersion> {
    try {
      this.logger.log(`恢复文件版本: ${fileId} -> ${options.targetVersionId}`)

      const versions = this.versions.get(fileId) || []
      const targetVersion = versions.find(v => v.id === options.targetVersionId)
      
      if (!targetVersion) {
        throw new NotFoundException(`目标版本不存在: ${options.targetVersionId}`)
      }

      // 创建备份（如果需要）
      if (options.createBackup) {
        const currentVersion = versions.find(v => v.isActive)
        if (currentVersion) {
          await this.createVersion(fileId, currentVersion.filePath, {
            comment: `恢复前备份 - ${options.comment || ''}`,
            createdBy: options.createdBy,
          })
        }
      }

      // 确保目标目录存在
      await fs.mkdir(dirname(targetPath), { recursive: true })

      // 复制版本文件到目标位置
      await fs.copyFile(targetVersion.filePath, targetPath)

      // 创建新版本记录
      const restoredVersion = await this.createVersion(fileId, targetPath, {
        comment: `恢复到版本 ${targetVersion.version} - ${options.comment || ''}`,
        createdBy: options.createdBy,
        tags: ['restored'],
      })

      // 记录事件
      await this.recordEvent({
        type: 'restore',
        fileId,
        versionId: restoredVersion.id,
        userId: options.createdBy,
        details: {
          targetVersionId: options.targetVersionId,
          targetVersion: targetVersion.version,
          comment: options.comment,
        },
      })

      this.logger.log(`文件版本恢复成功: ${fileId} v${targetVersion.version}`)
      return restoredVersion
    } catch (error) {
      this.logger.error(`恢复文件版本失败: ${fileId}`, error)
      throw error
    }
  }

  /**
   * 比较两个版本
   */
  async compareVersions(
    fileId: string,
    versionA: number,
    versionB: number
  ): Promise<VersionDiff> {
    const versions = this.versions.get(fileId) || []
    const versionAObj = versions.find(v => v.version === versionA)
    const versionBObj = versions.find(v => v.version === versionB)

    if (!versionAObj || !versionBObj) {
      throw new NotFoundException('指定的版本不存在')
    }

    // 简化的差异比较实现
    const changes = await this.calculateDifferences(versionAObj, versionBObj)
    const similarity = this.calculateSimilarity(versionAObj, versionBObj)

    return {
      versionA: versionAObj,
      versionB: versionBObj,
      changes,
      similarity,
    }
  }

  /**
   * 搜索版本
   */
  async searchVersions(query: VersionSearchQuery): Promise<{
    versions: FileVersion[]
    total: number
    hasMore: boolean
  }> {
    let allVersions: FileVersion[] = []

    // 收集所有版本
    for (const versions of this.versions.values()) {
      allVersions.push(...versions)
    }

    // 应用过滤条件
    let filteredVersions = allVersions.filter(version => {
      if (query.fileId && version.fileId !== query.fileId) return false
      if (query.fileName && !version.fileName.includes(query.fileName)) return false
      if (query.version && version.version !== query.version) return false
      if (query.createdBy && version.createdBy !== query.createdBy) return false
      if (query.dateFrom && version.createdAt < query.dateFrom) return false
      if (query.dateTo && version.createdAt > query.dateTo) return false
      if (query.tags && query.tags.length > 0) {
        const versionTags = version.tags || []
        if (!query.tags.some(tag => versionTags.includes(tag))) return false
      }
      return true
    })

    // 排序
    const sortBy = query.sortBy || 'createdAt'
    const sortOrder = query.sortOrder || 'desc'
    
    filteredVersions.sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case 'version':
          aValue = a.version
          bValue = b.version
          break
        case 'size':
          aValue = a.size
          bValue = b.size
          break
        case 'createdAt':
        default:
          aValue = a.createdAt.getTime()
          bValue = b.createdAt.getTime()
          break
      }

      if (sortOrder === 'asc') {
        return aValue - bValue
      } else {
        return bValue - aValue
      }
    })

    // 分页
    const offset = query.offset || 0
    const limit = query.limit || 50
    const paginatedVersions = filteredVersions.slice(offset, offset + limit)

    return {
      versions: paginatedVersions,
      total: filteredVersions.length,
      hasMore: offset + limit < filteredVersions.length,
    }
  }

  /**
   * 获取版本统计
   */
  async getVersionStats(): Promise<VersionStats> {
    const allVersions: FileVersion[] = []
    const fileVersionCounts = new Map<string, number>()
    const fileSizes = new Map<string, number>()

    for (const [fileId, versions] of this.versions.entries()) {
      allVersions.push(...versions)
      fileVersionCounts.set(fileId, versions.length)
      fileSizes.set(fileId, versions.reduce((sum, v) => sum + v.size, 0))
    }

    const totalSize = allVersions.reduce((sum, v) => sum + v.size, 0)
    const sortedDates = allVersions.map(v => v.createdAt).sort((a, b) => a.getTime() - b.getTime())

    // 获取版本数最多的文件
    const topVersionedFiles = Array.from(fileVersionCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([fileId, versionCount]) => {
        const versions = this.versions.get(fileId) || []
        return {
          fileId,
          fileName: versions[0]?.fileName || 'unknown',
          versionCount,
          totalSize: fileSizes.get(fileId) || 0,
        }
      })

    return {
      totalFiles: this.versions.size,
      totalVersions: allVersions.length,
      totalSize,
      averageVersionsPerFile: this.versions.size > 0 ? allVersions.length / this.versions.size : 0,
      oldestVersion: sortedDates[0] || new Date(),
      newestVersion: sortedDates[sortedDates.length - 1] || new Date(),
      topVersionedFiles,
    }
  }

  /**
   * 删除版本
   */
  async deleteVersion(fileId: string, versionId: string): Promise<void> {
    try {
      const versions = this.versions.get(fileId) || []
      const versionIndex = versions.findIndex(v => v.id === versionId)
      
      if (versionIndex === -1) {
        throw new NotFoundException(`版本不存在: ${versionId}`)
      }

      const version = versions[versionIndex]
      
      // 不允许删除活跃版本
      if (version.isActive) {
        throw new BadRequestException('不能删除活跃版本')
      }

      // 删除物理文件
      try {
        await fs.unlink(version.filePath)
      } catch (error) {
        this.logger.warn(`删除版本文件失败: ${version.filePath}`, error)
      }

      // 从版本列表中移除
      versions.splice(versionIndex, 1)
      this.versions.set(fileId, versions)

      // 记录事件
      await this.recordEvent({
        type: 'delete',
        fileId,
        versionId,
        details: {
          version: version.version,
          fileName: version.fileName,
        },
      })

      this.logger.log(`版本删除成功: ${fileId} v${version.version}`)
    } catch (error) {
      this.logger.error(`删除版本失败: ${fileId}/${versionId}`, error)
      throw error
    }
  }

  /**
   * 计算文件校验和
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath)
    return createHash('sha256').update(fileBuffer).digest('hex')
  }

  /**
   * 创建版本存储路径
   */
  private async createVersionStoragePath(fileId: string, version: number): Promise<string> {
    const versionDir = this.configService.get<string>('VERSION_STORAGE_DIR', 'versions')
    const fileVersionDir = join(versionDir, fileId)
    
    await fs.mkdir(fileVersionDir, { recursive: true })
    
    return join(fileVersionDir, `v${version}`)
  }

  /**
   * 获取MIME类型
   */
  private getMimeType(filePath: string): string {
    const ext = extname(filePath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.html': 'text/html',
      '.jpg': 'image/jpeg',
      '.png': 'image/png',
      '.pdf': 'application/pdf',
    }
    return mimeTypes[ext] || 'application/octet-stream'
  }

  /**
   * 计算版本差异
   */
  private async calculateDifferences(versionA: FileVersion, versionB: FileVersion): Promise<Array<{
    type: 'added' | 'removed' | 'modified'
    path?: string
    oldValue?: any
    newValue?: any
    description: string
  }>> {
    const changes = []

    // 基本属性比较
    if (versionA.size !== versionB.size) {
      changes.push({
        type: 'modified' as const,
        path: 'size',
        oldValue: versionA.size,
        newValue: versionB.size,
        description: `文件大小从 ${versionA.size} 字节变更为 ${versionB.size} 字节`,
      })
    }

    if (versionA.checksum !== versionB.checksum) {
      changes.push({
        type: 'modified' as const,
        path: 'content',
        description: '文件内容已修改',
      })
    }

    // 元数据比较
    const metadataA = versionA.metadata || {}
    const metadataB = versionB.metadata || {}
    
    for (const key of Object.keys(metadataA)) {
      if (!(key in metadataB)) {
        changes.push({
          type: 'removed' as const,
          path: `metadata.${key}`,
          oldValue: metadataA[key],
          description: `移除元数据字段: ${key}`,
        })
      } else if (metadataA[key] !== metadataB[key]) {
        changes.push({
          type: 'modified' as const,
          path: `metadata.${key}`,
          oldValue: metadataA[key],
          newValue: metadataB[key],
          description: `元数据字段 ${key} 从 ${metadataA[key]} 变更为 ${metadataB[key]}`,
        })
      }
    }

    for (const key of Object.keys(metadataB)) {
      if (!(key in metadataA)) {
        changes.push({
          type: 'added' as const,
          path: `metadata.${key}`,
          newValue: metadataB[key],
          description: `添加元数据字段: ${key}`,
        })
      }
    }

    return changes
  }

  /**
   * 计算版本相似度
   */
  private calculateSimilarity(versionA: FileVersion, versionB: FileVersion): number {
    if (versionA.checksum === versionB.checksum) {
      return 1.0 // 完全相同
    }

    // 基于文件大小的简单相似度计算
    const sizeDiff = Math.abs(versionA.size - versionB.size)
    const maxSize = Math.max(versionA.size, versionB.size)
    
    if (maxSize === 0) return 1.0
    
    return Math.max(0, 1 - (sizeDiff / maxSize))
  }

  /**
   * 清理旧版本
   */
  private async cleanupOldVersions(fileId: string): Promise<void> {
    const versions = this.versions.get(fileId) || []
    const maxVersions = this.config.maxVersionsPerFile

    if (versions.length <= maxVersions) {
      return
    }

    // 按版本号排序，保留最新的版本
    const sortedVersions = versions.sort((a, b) => b.version - a.version)
    const versionsToDelete = sortedVersions.slice(maxVersions)

    for (const version of versionsToDelete) {
      if (!version.isActive) {
        try {
          await fs.unlink(version.filePath)
          this.logger.log(`清理旧版本: ${fileId} v${version.version}`)
        } catch (error) {
          this.logger.warn(`清理版本文件失败: ${version.filePath}`, error)
        }
      }
    }

    // 更新版本列表
    const remainingVersions = sortedVersions.slice(0, maxVersions)
    this.versions.set(fileId, remainingVersions)
  }

  /**
   * 记录事件
   */
  private async recordEvent(event: Omit<VersioningEvent, 'id' | 'timestamp'>): Promise<void> {
    const versioningEvent: VersioningEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      ...event,
    }

    this.events.push(versioningEvent)

    // 限制事件数量
    if (this.events.length > 10000) {
      this.events = this.events.slice(-5000)
    }
  }

  /**
   * 加载配置
   */
  private loadConfig(): VersioningConfig {
    return {
      maxVersionsPerFile: this.configService.get<number>('VERSIONING_MAX_VERSIONS', 10),
      enableAutoVersioning: this.configService.get<boolean>('VERSIONING_AUTO_ENABLED', true),
      versionRetentionDays: this.configService.get<number>('VERSIONING_RETENTION_DAYS', 90),
      enableDiffGeneration: this.configService.get<boolean>('VERSIONING_DIFF_ENABLED', true),
      compressionEnabled: this.configService.get<boolean>('VERSIONING_COMPRESSION', false),
      storageLocation: this.configService.get<'local' | 'cdn'>('VERSIONING_STORAGE', 'local'),
    }
  }
}
