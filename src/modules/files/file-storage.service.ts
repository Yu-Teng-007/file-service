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
  FileReadMode,
  FileReadOptions,
  FileContentResult,
  FileChunkResult,
  FileReadStats,
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
  private readonly contentCache = new Map<
    string,
    { content: Buffer | string; timestamp: number; ttl: number }
  >()
  private readonly readStats: FileReadStats = {
    totalReads: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageReadTime: 0,
    totalBytesRead: 0,
  }

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || 'uploads'
    this.metadataFile = join(this.uploadDir, 'metadata.json')
    this.initializeStorage()

    // 定期清理过期缓存
    setInterval(() => this.cleanupExpiredCache(), 5 * 60 * 1000) // 每5分钟清理一次
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
    // 确保原始文件名使用正确的UTF-8编码
    const decodedOriginalName = this.decodeFileName(originalName)

    const fileId = uuidv4()
    const ext = extname(decodedOriginalName)
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
      originalName: decodedOriginalName,
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

  /**
   * 解码文件名，处理中文字符编码问题
   */
  private decodeFileName(filename: string): string {
    try {
      // 检查是否已经是正确的UTF-8编码
      if (this.isValidUTF8(filename)) {
        return filename
      }

      // 尝试从ISO-8859-1解码为UTF-8
      const buffer = Buffer.from(filename, 'latin1')
      const decoded = buffer.toString('utf8')

      // 验证解码结果是否有效
      if (this.isValidUTF8(decoded)) {
        return decoded
      }

      // 如果解码失败，返回原始文件名
      return filename
    } catch (error) {
      // 解码失败时返回原始文件名
      return filename
    }
  }

  /**
   * 检查字符串是否为有效的UTF-8编码
   */
  private isValidUTF8(str: string): boolean {
    try {
      // 检查是否包含乱码字符
      const hasGarbledChars = /[\uFFFD\u00C2-\u00C3][\u0080-\u00BF]/.test(str)
      if (hasGarbledChars) {
        return false
      }

      // 检查是否包含中文字符且显示正常
      const hasChinese = /[\u4e00-\u9fff]/.test(str)
      if (hasChinese) {
        // 如果包含中文，检查是否显示正常
        return !str.includes('�') && !str.includes('?')
      }

      return true
    } catch {
      return false
    }
  }

  /**
   * 读取文件内容
   */
  async readFileContent(fileId: string, options: FileReadOptions = {}): Promise<FileContentResult> {
    const startTime = Date.now()

    // 获取文件信息
    const fileInfo = this.fileMetadata.get(fileId)
    if (!fileInfo) {
      throw new NotFoundException('文件不存在')
    }

    // 验证文件路径安全性
    this.validateFilePath(fileInfo.path)

    // 检查文件是否存在
    if (!(await this.fileExists(fileInfo.path))) {
      throw new NotFoundException('文件不存在或已被删除')
    }

    const {
      mode = FileReadMode.FULL,
      encoding = 'buffer',
      start = 0,
      end,
      maxSize = 100 * 1024 * 1024, // 默认最大100MB
      useCache = true,
      cacheKey,
      cacheTTL = 300, // 默认缓存5分钟
    } = options

    // 生成缓存键
    const finalCacheKey = cacheKey || `${fileId}:${mode}:${encoding}:${start}:${end || 'end'}`

    // 检查缓存
    if (useCache && this.contentCache.has(finalCacheKey)) {
      const cached = this.contentCache.get(finalCacheKey)!
      if (Date.now() - cached.timestamp < cached.ttl * 1000) {
        this.readStats.cacheHits++
        return {
          content: cached.content,
          size: Buffer.isBuffer(cached.content)
            ? cached.content.length
            : Buffer.byteLength(cached.content),
          mimeType: fileInfo.mimeType,
          encoding: encoding === 'buffer' ? undefined : (encoding as BufferEncoding),
          fromCache: true,
          readTime: Date.now() - startTime,
        }
      } else {
        // 清理过期缓存
        this.contentCache.delete(finalCacheKey)
      }
    }

    this.readStats.cacheMisses++

    try {
      let content: Buffer | string
      let actualSize: number

      switch (mode) {
        case FileReadMode.FULL:
          content = await this.readFullContent(fileInfo.path, encoding, maxSize)
          break
        case FileReadMode.PARTIAL:
          content = await this.readPartialContent(fileInfo.path, encoding, start, end, maxSize)
          break
        default:
          throw new Error(`不支持的读取模式: ${mode}`)
      }

      actualSize = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content)

      // 更新统计信息
      this.readStats.totalReads++
      this.readStats.totalBytesRead += actualSize
      const readTime = Date.now() - startTime
      this.readStats.averageReadTime =
        (this.readStats.averageReadTime * (this.readStats.totalReads - 1) + readTime) /
        this.readStats.totalReads

      // 缓存结果
      if (useCache && actualSize <= 10 * 1024 * 1024) {
        // 只缓存小于10MB的文件
        this.contentCache.set(finalCacheKey, {
          content,
          timestamp: Date.now(),
          ttl: cacheTTL,
        })
      }

      return {
        content,
        size: actualSize,
        mimeType: fileInfo.mimeType,
        encoding: encoding === 'buffer' ? undefined : (encoding as BufferEncoding),
        fromCache: false,
        readTime,
      }
    } catch (error) {
      throw new Error(`读取文件内容失败: ${error.message}`)
    }
  }

  /**
   * 分块读取文件内容
   */
  async *readFileChunks(
    fileId: string,
    options: FileReadOptions = {}
  ): AsyncGenerator<FileChunkResult, void, unknown> {
    const fileInfo = this.fileMetadata.get(fileId)
    if (!fileInfo) {
      throw new NotFoundException('文件不存在')
    }

    this.validateFilePath(fileInfo.path)

    if (!(await this.fileExists(fileInfo.path))) {
      throw new NotFoundException('文件不存在或已被删除')
    }

    const {
      encoding = 'buffer',
      chunkSize = 64 * 1024, // 默认64KB
      start = 0,
      end,
    } = options

    const stats = await fs.stat(fileInfo.path)
    const fileSize = stats.size
    const actualEnd = end !== undefined ? Math.min(end, fileSize) : fileSize
    const totalSize = actualEnd - start
    const totalChunks = Math.ceil(totalSize / chunkSize)

    let currentOffset = start
    let chunkIndex = 0

    while (currentOffset < actualEnd) {
      const currentChunkSize = Math.min(chunkSize, actualEnd - currentOffset)
      const chunk = await this.readPartialContent(
        fileInfo.path,
        encoding,
        currentOffset,
        currentOffset + currentChunkSize - 1
      )

      yield {
        chunk,
        chunkIndex,
        totalChunks,
        isLast: chunkIndex === totalChunks - 1,
        size: Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk),
        offset: currentOffset,
      }

      currentOffset += currentChunkSize
      chunkIndex++
    }
  }

  /**
   * 验证文件路径安全性
   */
  private validateFilePath(filePath: string): void {
    // 检查路径是否在允许的目录内
    const normalizedPath = join(process.cwd(), filePath).replace(/\\/g, '/')
    const normalizedUploadDir = join(process.cwd(), this.uploadDir).replace(/\\/g, '/')

    if (!normalizedPath.startsWith(normalizedUploadDir)) {
      throw new Error('文件路径不在允许的目录范围内')
    }

    // 检查是否包含危险的路径遍历字符
    if (filePath.includes('..') || filePath.includes('~')) {
      throw new Error('文件路径包含非法字符')
    }

    // 检查路径长度
    if (filePath.length > 260) {
      // Windows路径长度限制
      throw new Error('文件路径过长')
    }
  }

  /**
   * 完整读取文件内容
   */
  private async readFullContent(
    filePath: string,
    encoding: BufferEncoding | 'buffer',
    maxSize: number
  ): Promise<Buffer | string> {
    // 检查文件大小
    const stats = await fs.stat(filePath)
    if (stats.size > maxSize) {
      throw new Error(`文件大小 ${stats.size} 字节超过限制 ${maxSize} 字节`)
    }

    if (encoding === 'buffer') {
      return await fs.readFile(filePath)
    } else {
      return await fs.readFile(filePath, encoding)
    }
  }

  /**
   * 部分读取文件内容
   */
  private async readPartialContent(
    filePath: string,
    encoding: BufferEncoding | 'buffer',
    start: number,
    end?: number,
    maxSize?: number
  ): Promise<Buffer | string> {
    const stats = await fs.stat(filePath)
    const fileSize = stats.size

    // 验证读取范围
    if (start < 0 || start >= fileSize) {
      throw new Error(`起始位置 ${start} 超出文件范围 [0, ${fileSize}]`)
    }

    const actualEnd = end !== undefined ? Math.min(end, fileSize - 1) : fileSize - 1
    const readSize = actualEnd - start + 1

    if (maxSize && readSize > maxSize) {
      throw new Error(`读取大小 ${readSize} 字节超过限制 ${maxSize} 字节`)
    }

    // 使用文件描述符进行部分读取
    const fileHandle = await fs.open(filePath, 'r')
    try {
      const buffer = Buffer.alloc(readSize)
      const { bytesRead } = await fileHandle.read(buffer, 0, readSize, start)

      if (encoding === 'buffer') {
        return buffer.slice(0, bytesRead)
      } else {
        return buffer.slice(0, bytesRead).toString(encoding)
      }
    } finally {
      await fileHandle.close()
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanupExpiredCache(): void {
    const now = Date.now()
    for (const [key, cached] of this.contentCache.entries()) {
      if (now - cached.timestamp >= cached.ttl * 1000) {
        this.contentCache.delete(key)
      }
    }
  }

  /**
   * 获取文件读取统计信息
   */
  getReadStats(): FileReadStats {
    return { ...this.readStats }
  }

  /**
   * 清空文件内容缓存
   */
  clearContentCache(): void {
    this.contentCache.clear()
  }

  /**
   * 获取缓存信息
   */
  getCacheInfo(): { size: number; keys: string[] } {
    return {
      size: this.contentCache.size,
      keys: Array.from(this.contentCache.keys()),
    }
  }
}
