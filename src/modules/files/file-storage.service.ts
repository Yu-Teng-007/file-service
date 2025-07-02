import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { promises as fs } from 'fs'
import { join, extname, dirname } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { CDNService } from '../cdn/cdn.service'

import {
  FileCategory,
  FileAccessLevel,
  UploadedFileInfo,
  FileUploadOptions,
  FileSearchQuery,
  FileBatchOperation,
  FileStats,
} from '../../types/file.types'

interface StoredFileMetadata {
  id: string
  originalName: string
  filename: string
  path: string
  url: string
  category: FileCategory
  accessLevel: FileAccessLevel
  size: number
  mimeType: string
  uploadedBy?: string
  uploadedAt: string
  metadata?: Record<string, any>
  checksum?: string
}

@Injectable()
export class FileStorageService {
  private readonly uploadDir: string
  private readonly metadataFile: string
  private fileMetadata: Map<string, StoredFileMetadata> = new Map()

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || 'uploads'
    this.metadataFile = join(this.uploadDir, 'metadata.json')
    this.initializeStorage()
  }

  /**
   * 初始化存储系统
   */
  private async initializeStorage(): Promise<void> {
    try {
      // 确保上传目录存在
      await fs.mkdir(this.uploadDir, { recursive: true })

      // 创建各分类目录
      for (const category of Object.values(FileCategory)) {
        await fs.mkdir(join(this.uploadDir, category), { recursive: true })
      }

      // 加载元数据
      await this.loadMetadata()
    } catch (error) {
      console.error('初始化存储系统失败:', error)
    }
  }

  /**
   * 加载文件元数据
   */
  private async loadMetadata(): Promise<void> {
    try {
      const data = await fs.readFile(this.metadataFile, 'utf8')
      const metadata = JSON.parse(data)

      for (const [id, info] of Object.entries(metadata)) {
        this.fileMetadata.set(id, info as StoredFileMetadata)
      }
    } catch (error) {
      // 元数据文件不存在或损坏，创建新的
      await this.saveMetadata()
    }
  }

  /**
   * 保存文件元数据
   */
  private async saveMetadata(): Promise<void> {
    const metadata = Object.fromEntries(this.fileMetadata)
    await fs.writeFile(this.metadataFile, JSON.stringify(metadata, null, 2))
  }

  /**
   * 存储文件
   */
  async storeFile(
    tempFilePath: string,
    originalName: string,
    category: FileCategory,
    options: FileUploadOptions = {},
    additionalInfo: Partial<UploadedFileInfo> = {}
  ): Promise<UploadedFileInfo> {
    const fileId = uuidv4()
    const ext = extname(originalName)
    const filename = options.customPath ? `${options.customPath}${ext}` : `${fileId}${ext}`

    const categoryDir = join(this.uploadDir, category)
    const finalPath = join(categoryDir, filename)

    // 检查文件是否已存在
    if (!options.overwrite && (await this.fileExists(finalPath))) {
      throw new ConflictException(`文件 ${filename} 已存在`)
    }

    // 确保目标目录存在
    await fs.mkdir(dirname(finalPath), { recursive: true })

    // 移动文件到最终位置
    await fs.rename(tempFilePath, finalPath)

    // 获取文件信息
    const stats = await fs.stat(finalPath)

    const fileInfo: UploadedFileInfo = {
      id: fileId,
      originalName,
      filename,
      path: finalPath,
      url: `/uploads/${category}/${filename}`,
      category,
      accessLevel: options.accessLevel || FileAccessLevel.PUBLIC,
      size: stats.size,
      mimeType: additionalInfo.mimeType || 'application/octet-stream',
      uploadedBy: additionalInfo.uploadedBy,
      uploadedAt: new Date(),
      metadata: options.metadata,
      checksum: additionalInfo.checksum,
    }

    // 保存元数据
    const metadata: StoredFileMetadata = {
      ...fileInfo,
      uploadedAt: fileInfo.uploadedAt.toISOString(),
    }

    this.fileMetadata.set(fileId, metadata)
    await this.saveMetadata()

    return fileInfo
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(fileId: string): Promise<UploadedFileInfo | null> {
    const metadata = this.fileMetadata.get(fileId)
    if (!metadata) {
      return null
    }

    return {
      ...metadata,
      uploadedAt: new Date(metadata.uploadedAt),
    }
  }

  /**
   * 搜索文件
   */
  async searchFiles(query: FileSearchQuery): Promise<{
    files: UploadedFileInfo[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    let files = Array.from(this.fileMetadata.values())

    // 应用筛选条件
    if (query.category) {
      files = files.filter(f => f.category === query.category)
    }

    if (query.accessLevel) {
      files = files.filter(f => f.accessLevel === query.accessLevel)
    }

    if (query.uploadedBy) {
      files = files.filter(f => f.uploadedBy === query.uploadedBy)
    }

    if (query.filename) {
      const searchTerm = query.filename.toLowerCase()
      files = files.filter(f => f.filename.toLowerCase().includes(searchTerm))
    }

    if (query.originalName) {
      const searchTerm = query.originalName.toLowerCase()
      files = files.filter(f => f.originalName.toLowerCase().includes(searchTerm))
    }

    if (query.mimeType) {
      files = files.filter(f => f.mimeType === query.mimeType)
    }

    if (query.dateFrom) {
      const fromDate = new Date(query.dateFrom)
      files = files.filter(f => new Date(f.uploadedAt) >= fromDate)
    }

    if (query.dateTo) {
      const toDate = new Date(query.dateTo)
      files = files.filter(f => new Date(f.uploadedAt) <= toDate)
    }

    if (query.minSize !== undefined) {
      files = files.filter(f => f.size >= query.minSize)
    }

    if (query.maxSize !== undefined) {
      files = files.filter(f => f.size <= query.maxSize)
    }

    // 排序
    const sortBy = query.sortBy || 'date'
    const sortOrder = query.sortOrder || 'desc'

    files.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'name':
          comparison = a.filename.localeCompare(b.filename)
          break
        case 'size':
          comparison = a.size - b.size
          break
        case 'category':
          comparison = a.category.localeCompare(b.category)
          break
        case 'date':
        default:
          comparison = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
          break
      }

      return sortOrder === 'desc' ? -comparison : comparison
    })

    // 分页
    const page = query.page || 1
    const limit = query.limit || 20
    const total = files.length
    const totalPages = Math.ceil(total / limit)
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit

    const paginatedFiles = files.slice(startIndex, endIndex).map(metadata => ({
      ...metadata,
      uploadedAt: new Date(metadata.uploadedAt),
    }))

    return {
      files: paginatedFiles,
      total,
      page,
      limit,
      totalPages,
    }
  }

  /**
   * 更新文件信息
   */
  async updateFileInfo(
    fileId: string,
    updates: Partial<UploadedFileInfo>
  ): Promise<UploadedFileInfo> {
    const metadata = this.fileMetadata.get(fileId)
    if (!metadata) {
      throw new NotFoundException('文件不存在')
    }

    // 如果更新文件名，需要重命名物理文件
    if (updates.filename && updates.filename !== metadata.filename) {
      const oldPath = metadata.path
      const newFilename = updates.filename + extname(metadata.filename)
      const newPath = join(dirname(oldPath), newFilename)

      await fs.rename(oldPath, newPath)

      metadata.filename = newFilename
      metadata.path = newPath
      metadata.url = `/uploads/${metadata.category}/${newFilename}`
    }

    // 更新其他字段
    Object.assign(metadata, updates)

    this.fileMetadata.set(fileId, metadata)
    await this.saveMetadata()

    return {
      ...metadata,
      uploadedAt: new Date(metadata.uploadedAt),
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(fileId: string): Promise<void> {
    const metadata = this.fileMetadata.get(fileId)
    if (!metadata) {
      throw new NotFoundException('文件不存在')
    }

    // 删除物理文件
    try {
      await fs.unlink(metadata.path)
    } catch (error) {
      console.warn(`删除物理文件失败: ${metadata.path}`, error)
    }

    // 删除元数据
    this.fileMetadata.delete(fileId)
    await this.saveMetadata()
  }

  /**
   * 批量操作
   */
  async batchOperation(
    operation: FileBatchOperation
  ): Promise<{ success: number; failed: number; errors: string[]; processed: number }> {
    const results = { success: 0, failed: 0, errors: [], processed: 0 }

    for (const fileId of operation.fileIds) {
      results.processed++
      try {
        switch (operation.action) {
          case 'delete':
            await this.deleteFile(fileId)
            break
          case 'changeAccess':
            if (operation.targetAccessLevel) {
              await this.updateFileInfo(fileId, { accessLevel: operation.targetAccessLevel })
            }
            break
          // TODO: 实现 move 和 copy 操作
        }
        results.success++
      } catch (error) {
        results.failed++
        results.errors.push(`文件 ${fileId}: ${error.message}`)
      }
    }

    return results
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<FileStats> {
    const files = Array.from(this.fileMetadata.values())

    const stats: FileStats = {
      totalFiles: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      categoryCounts: {} as Record<FileCategory, number>,
      categorySizes: {} as Record<FileCategory, number>,
      accessLevelCounts: {} as any,
    }

    // 初始化计数器
    for (const category of Object.values(FileCategory)) {
      stats.categoryCounts[category] = 0
      stats.categorySizes[category] = 0
    }

    stats.accessLevelCounts = { public: 0, private: 0, protected: 0 }

    // 统计数据
    for (const file of files) {
      stats.categoryCounts[file.category]++
      stats.categorySizes[file.category] += file.size
      stats.accessLevelCounts[file.accessLevel]++
    }

    return stats
  }

  /**
   * 清理临时文件
   */
  async cleanupTempFiles(): Promise<void> {
    const tempDir = join(this.uploadDir, FileCategory.TEMP)

    try {
      const files = await fs.readdir(tempDir)
      const now = Date.now()
      const maxAge = 24 * 60 * 60 * 1000 // 24小时

      for (const file of files) {
        const filePath = join(tempDir, file)
        const stats = await fs.stat(filePath)

        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath)
        }
      }
    } catch (error) {
      console.warn('清理临时文件失败:', error)
    }
  }
}
