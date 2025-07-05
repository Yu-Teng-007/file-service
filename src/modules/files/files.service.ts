import { Injectable, BadRequestException, StreamableFile } from '@nestjs/common'
import {
  FileNotFoundException,
  FileValidationException,
  FileProcessingException,
  UnsupportedFileTypeException,
} from '../../common/exceptions/custom.exceptions'
import {
  FileReadOptions,
  FileContentResult,
  FileChunkResult,
  FileReadStats,
} from '../../types/file.types'
import { Retry, FILE_OPERATION_RETRY_OPTIONS } from '../../common/utils/retry.util'
import { ErrorRecoveryService } from '../../common/services/error-recovery.service'
import { ConfigService } from '@nestjs/config'
import { promises as fs, createReadStream } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import * as mammoth from 'mammoth'
import * as XLSX from 'xlsx'

import { FileValidationService } from './file-validation.service'
import { FileStorageService } from './file-storage.service'
import { CacheService } from '../cache/cache.service'
import {
  UploadedFileInfo,
  FileSearchQuery,
  FileBatchOperation,
  FileStats,
  FileAccessLevel,
} from '../../types/file.types'
import {
  FileUploadDto,
  FileSearchDto,
  FileBatchOperationDto,
  FileUpdateDto,
  FileResponseDto,
  FileListResponseDto,
  FileStatsResponseDto,
} from '../../dto'

@Injectable()
export class FilesService {
  constructor(
    private readonly configService: ConfigService,
    private readonly validationService: FileValidationService,
    private readonly storageService: FileStorageService,
    private readonly cacheService: CacheService,
    private readonly errorRecoveryService: ErrorRecoveryService
  ) {}

  /**
   * 上传单个文件
   */
  @Retry(FILE_OPERATION_RETRY_OPTIONS)
  async uploadFile(file: Express.Multer.File, uploadDto: FileUploadDto): Promise<FileResponseDto> {
    if (!file) {
      throw new BadRequestException('请选择要上传的文件')
    }

    // 验证文件
    const validation = await this.validationService.validateFile(file)
    if (!validation.isValid) {
      // 清理临时文件
      await this.cleanupTempFile(file.path)
      throw new FileValidationException(validation.errors)
    }

    try {
      // 计算文件校验和
      const checksum = await this.validationService.calculateChecksum(file.path)

      // 解析元数据
      let metadata: Record<string, any> | undefined
      if (uploadDto.metadata) {
        try {
          metadata = JSON.parse(uploadDto.metadata)
        } catch (error) {
          throw new BadRequestException('元数据格式无效，必须是有效的JSON字符串')
        }
      }

      // 存储文件
      const fileInfo = await this.storageService.storeFile(
        file.path,
        file.originalname,
        uploadDto.category || validation.category,
        {
          accessLevel: uploadDto.accessLevel,
          customPath: uploadDto.customPath,
          folderId: uploadDto.folderId,
          metadata,
          overwrite: uploadDto.overwrite,
        },
        {
          mimeType: file.mimetype,
          checksum,
        }
      )

      return this.mapToResponseDto(fileInfo)
    } catch (error) {
      // 清理临时文件
      await this.cleanupTempFile(file.path)

      // 尝试错误恢复
      try {
        await this.errorRecoveryService.executeRecovery(error)
      } catch (recoveryError) {
        // 恢复失败，记录日志但不影响原始错误
      }

      throw error
    }
  }

  /**
   * 上传多个文件
   */
  async uploadMultipleFiles(
    files: Express.Multer.File[],
    uploadDto: FileUploadDto
  ): Promise<FileResponseDto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('请选择要上传的文件')
    }

    const results: FileResponseDto[] = []
    const errors: string[] = []

    for (const file of files) {
      try {
        const result = await this.uploadFile(file, uploadDto)
        results.push(result)
      } catch (error) {
        errors.push(`${file.originalname}: ${error.message}`)
        // 清理失败的临时文件
        await this.cleanupTempFile(file.path)
      }
    }

    if (errors.length > 0 && results.length === 0) {
      throw new BadRequestException(`所有文件上传失败: ${errors.join('; ')}`)
    }

    return results
  }

  /**
   * 获取文件列表
   */
  async getFiles(searchDto: FileSearchDto): Promise<FileListResponseDto> {
    const query: FileSearchQuery = {
      category: searchDto.category,
      accessLevel: searchDto.accessLevel,
      uploadedBy: searchDto.uploadedBy,
      filename: searchDto.filename,
      originalName: searchDto.originalName,
      search: searchDto.search,
      dateFrom: searchDto.dateFrom ? new Date(searchDto.dateFrom) : undefined,
      dateTo: searchDto.dateTo ? new Date(searchDto.dateTo) : undefined,
      minSize: searchDto.minSize,
      maxSize: searchDto.maxSize,
      mimeType: searchDto.mimeType,
      folderId: searchDto.folderId,
      page: searchDto.page,
      limit: searchDto.limit,
      sortBy: searchDto.sortBy,
      sortOrder: searchDto.sortOrder,
      validateExistence: searchDto.validateExistence,
      autoCleanup: searchDto.autoCleanup,
    }

    const result = await this.storageService.searchFiles(query)

    return {
      files: result.files.map(file => this.mapToResponseDto(file)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    }
  }

  /**
   * 根据ID获取文件信息
   */
  async getFileById(id: string): Promise<FileResponseDto> {
    const fileInfo = await this.storageService.getFileInfo(id)
    if (!fileInfo) {
      throw new FileNotFoundException(id)
    }

    return this.mapToResponseDto(fileInfo)
  }

  /**
   * 更新文件信息
   */
  async updateFile(id: string, updateDto: FileUpdateDto): Promise<FileResponseDto> {
    // 验证文件名
    if (updateDto.filename) {
      const validation = this.validationService.validateFileName(updateDto.filename)
      if (!validation.isValid) {
        throw new BadRequestException(`文件名无效: ${validation.errors.join(', ')}`)
      }
    }

    // 解析元数据
    let metadata: Record<string, any> | undefined
    if (updateDto.metadata) {
      try {
        metadata = JSON.parse(updateDto.metadata)
      } catch (error) {
        throw new BadRequestException('元数据格式无效，必须是有效的JSON字符串')
      }
    }

    const updates: Partial<UploadedFileInfo> = {}
    if (updateDto.filename) updates.filename = updateDto.filename
    if (updateDto.accessLevel) updates.accessLevel = updateDto.accessLevel
    if (updateDto.category) updates.category = updateDto.category
    if (metadata) updates.metadata = metadata

    const fileInfo = await this.storageService.updateFileInfo(id, updates)
    return this.mapToResponseDto(fileInfo)
  }

  /**
   * 创建文件记录
   */
  async createFileRecord(fileData: {
    filename: string
    originalName: string
    mimeType: string
    size: number
    path: string
    folderId?: string | null
  }): Promise<FileResponseDto> {
    const fileId = uuidv4()
    // 根据MIME类型确定分类
    let category = 'files' as any
    if (fileData.mimeType.startsWith('image/')) {
      category = 'images'
    } else if (fileData.mimeType.startsWith('video/')) {
      category = 'videos'
    } else if (fileData.mimeType.startsWith('audio/')) {
      category = 'music'
    } else if (fileData.mimeType.includes('document') || fileData.mimeType.includes('pdf')) {
      category = 'documents'
    }

    const fileInfo: UploadedFileInfo = {
      id: fileId,
      originalName: fileData.originalName,
      filename: fileData.filename,
      path: fileData.path,
      url: `/uploads/files/${fileData.filename}`,
      category,
      accessLevel: FileAccessLevel.PUBLIC,
      size: fileData.size,
      mimeType: fileData.mimeType,
      uploadedAt: new Date(),
      folderId: fileData.folderId,
    }

    // 直接添加到存储服务的内存映射中
    const metadata = {
      ...fileInfo,
      uploadedAt: fileInfo.uploadedAt.toISOString(),
    }

    // 使用反射访问私有方法来保存元数据
    const storageService = this.storageService as any
    storageService.fileMetadata.set(fileId, metadata)
    await storageService.saveMetadata()

    return this.mapToResponseDto(fileInfo)
  }

  /**
   * 删除文件（移动到回收站）
   */
  async deleteFile(id: string): Promise<void> {
    // 获取文件信息
    const fileInfo = await this.storageService.getFileInfo(id)

    // 动态导入 TrashService 以避免循环依赖
    const { TrashService } = await import('../trash/trash.service')
    const trashService = new TrashService(this.configService, this.storageService)

    // 将文件移动到回收站
    await trashService.moveToTrash(fileInfo)

    // 从存储服务中移除文件记录（但不删除物理文件，因为已经移动到回收站）
    this.storageService.removeFileFromMetadata(id)
  }

  /**
   * 同步文件元数据与物理文件
   * 清理指向不存在物理文件的元数据记录
   */
  async syncFileMetadata(): Promise<{
    totalFiles: number
    removedFiles: string[]
    errors: string[]
  }> {
    const result = await this.storageService.syncFileMetadata()

    // 如果有文件被清理，通知文件夹服务更新统计
    if (result.removedFiles.length > 0 && result.affectedFolders.size > 0) {
      try {
        // 动态导入 FoldersService 以避免循环依赖
        const { FoldersService } = await import('../folders/folders.service')
        const foldersService = new FoldersService(this.configService, this.storageService)

        // 刷新受影响文件夹的统计信息
        await foldersService.refreshFolderStats(Array.from(result.affectedFolders))
      } catch (error) {
        result.errors.push(`更新文件夹统计信息失败: ${error.message}`)
      }
    }

    // 返回结果时不包含 affectedFolders，保持API兼容性
    return {
      totalFiles: result.totalFiles,
      removedFiles: result.removedFiles,
      errors: result.errors,
    }
  }

  /**
   * 验证文件完整性
   * 检查但不删除不存在的文件记录
   */
  async validateFileIntegrity(): Promise<{
    totalFiles: number
    missingFiles: Array<{
      id: string
      originalName: string
      path: string
    }>
    errors: string[]
  }> {
    return await this.storageService.validateFileIntegrity()
  }

  /**
   * 批量操作
   */
  async batchOperation(batchDto: FileBatchOperationDto): Promise<any> {
    const operation: FileBatchOperation = {
      action: batchDto.action,
      fileIds: batchDto.fileIds,
      targetCategory: batchDto.targetCategory,
      targetAccessLevel: batchDto.targetAccessLevel,
    }

    return await this.storageService.batchOperation(operation)
  }

  /**
   * 获取统计信息
   */
  async getFileStats(): Promise<FileStatsResponseDto> {
    const stats = await this.storageService.getStats()
    return stats
  }

  /**
   * 清理临时文件
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath)
    } catch (error) {
      // 清理临时文件失败，忽略错误
    }
  }

  /**
   * 获取文件流用于下载
   */
  async getFileStream(id: string): Promise<{ stream: StreamableFile; fileInfo: UploadedFileInfo }> {
    const fileInfo = await this.storageService.getFileInfo(id)
    if (!fileInfo) {
      throw new FileNotFoundException(id)
    }

    // 检查文件是否存在
    try {
      await fs.access(fileInfo.path)
    } catch (error) {
      throw new FileNotFoundException(id, '文件不存在或已被删除')
    }

    const stream = createReadStream(fileInfo.path)
    return {
      stream: new StreamableFile(stream),
      fileInfo,
    }
  }

  /**
   * 获取文件预览流
   */
  async getFilePreview(
    id: string
  ): Promise<{ stream: StreamableFile; fileInfo: UploadedFileInfo }> {
    // 对于预览，我们使用相同的逻辑，但可以在未来添加特殊处理
    // 比如对图片生成缩略图，对文档生成预览等
    return this.getFileStream(id)
  }

  /**
   * 获取文件缩略图流
   */
  async getFileThumbnail(
    id: string,
    size: 'small' | 'medium' | 'large' = 'medium'
  ): Promise<{ stream: StreamableFile; fileInfo: UploadedFileInfo }> {
    const fileInfo = await this.storageService.getFileInfo(id)
    if (!fileInfo) {
      throw new FileNotFoundException(id)
    }

    // 检查是否为图片文件
    if (!fileInfo.mimeType.startsWith('image/')) {
      throw new BadRequestException('只有图片文件支持缩略图功能')
    }

    // 目前返回原图，未来可以集成图片处理服务生成真正的缩略图
    return this.getFileStream(id)
  }

  /**
   * 读取文件内容
   */
  @Retry(FILE_OPERATION_RETRY_OPTIONS)
  async readFileContent(id: string, options: FileReadOptions = {}): Promise<FileContentResult> {
    try {
      return await this.storageService.readFileContent(id, options)
    } catch (error) {
      if (error.message.includes('文件不存在')) {
        throw new FileNotFoundException(id, error.message)
      }
      throw new FileProcessingException(`读取文件内容失败: ${error.message}`)
    }
  }

  /**
   * 分块读取文件内容
   */
  async *readFileChunks(
    id: string,
    options: FileReadOptions = {}
  ): AsyncGenerator<FileChunkResult, void, unknown> {
    try {
      yield* this.storageService.readFileChunks(id, options)
    } catch (error) {
      if (error.message.includes('文件不存在')) {
        throw new FileNotFoundException(id, error.message)
      }
      throw new FileProcessingException(`分块读取文件失败: ${error.message}`)
    }
  }

  /**
   * 读取文本文件内容
   */
  async readTextFile(id: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    const result = await this.readFileContent(id, { encoding })

    if (typeof result.content !== 'string') {
      throw new FileProcessingException('文件内容不是文本格式')
    }

    return result.content
  }

  /**
   * 读取JSON文件内容
   */
  async readJsonFile<T = any>(id: string): Promise<T> {
    const content = await this.readTextFile(id, 'utf8')

    try {
      return JSON.parse(content)
    } catch (error) {
      throw new FileProcessingException(`JSON文件解析失败: ${error.message}`)
    }
  }

  /**
   * 获取文件读取统计信息
   */
  getFileReadStats(): FileReadStats {
    return this.storageService.getReadStats()
  }

  /**
   * 清空文件内容缓存
   */
  clearFileContentCache(): void {
    this.storageService.clearContentCache()
  }

  /**
   * 映射到响应DTO
   */
  private mapToResponseDto(fileInfo: UploadedFileInfo): FileResponseDto {
    return {
      id: fileInfo.id,
      originalName: fileInfo.originalName,
      filename: fileInfo.filename,
      path: fileInfo.path,
      url: fileInfo.url,
      category: fileInfo.category,
      accessLevel: fileInfo.accessLevel,
      size: fileInfo.size,
      mimeType: fileInfo.mimeType,
      uploadedBy: fileInfo.uploadedBy,
      uploadedAt: fileInfo.uploadedAt,
      folderId: fileInfo.folderId,
      metadata: fileInfo.metadata,
      checksum: fileInfo.checksum,
    }
  }

  /**
   * 获取文件预览信息
   */
  async getFilePreviewInfo(id: string): Promise<any> {
    const fileInfo = await this.storageService.getFileInfo(id)
    if (!fileInfo) {
      throw new FileNotFoundException(id)
    }

    const previewType = this.determinePreviewType(fileInfo.mimeType, fileInfo.originalName)
    const baseUrl = this.configService.get<string>('API_BASE_URL') || 'http://localhost:3001'

    const result = {
      id: fileInfo.id,
      type: previewType,
      previewUrl: `${baseUrl}/api/files/${id}/preview`,
      thumbnailUrl: previewType === 'image' ? `${baseUrl}/api/files/${id}/thumbnail` : undefined,
      canEdit: previewType === 'image',
      metadata: await this.extractFileMetadata(fileInfo),
    }

    return result
  }

  /**
   * 获取Word文档预览HTML
   */
  async getWordDocumentPreview(id: string): Promise<{ html: string; fileInfo: UploadedFileInfo }> {
    const fileInfo = await this.storageService.getFileInfo(id)
    if (!fileInfo) {
      throw new FileNotFoundException(id)
    }

    // 检查文件是否为Word文档
    const ext = fileInfo.originalName.split('.').pop()?.toLowerCase()
    if (!['doc', 'docx'].includes(ext)) {
      throw new UnsupportedFileTypeException('不支持的Word文档格式')
    }

    try {
      // 检查文件是否存在
      await fs.access(fileInfo.path)

      // 使用mammoth转换Word文档为HTML
      const result = await mammoth.convertToHtml({ path: fileInfo.path })

      // 处理转换警告
      if (result.messages.length > 0) {
        // Word文档转换有警告，但继续处理
      }

      return {
        html: result.value,
        fileInfo,
      }
    } catch (error) {
      throw new FileProcessingException('Word文档预览生成失败')
    }
  }

  /**
   * 获取Excel文档预览HTML
   */
  async getExcelDocumentPreview(id: string): Promise<{ html: string; fileInfo: UploadedFileInfo }> {
    const fileInfo = await this.storageService.getFileInfo(id)
    if (!fileInfo) {
      throw new FileNotFoundException(id)
    }

    // 检查文件是否为Excel文档
    const ext = fileInfo.originalName.split('.').pop()?.toLowerCase()
    if (!['xls', 'xlsx'].includes(ext)) {
      throw new UnsupportedFileTypeException('不支持的Excel文档格式')
    }

    try {
      // 检查文件是否存在
      await fs.access(fileInfo.path)

      // 检查XLSX库是否可用
      if (!XLSX) {
        throw new Error('XLSX库未正确加载')
      }

      // 读取Excel文件
      const workbook = XLSX.readFile(fileInfo.path)

      // 获取所有工作表名称
      const sheetNames = workbook.SheetNames
      if (sheetNames.length === 0) {
        throw new Error('Excel文件中没有找到工作表')
      }

      // 生成HTML内容
      let html = '<div class="excel-preview">'

      // 如果有多个工作表，添加标签页
      if (sheetNames.length > 1) {
        html += '<div class="excel-tabs">'
        sheetNames.forEach((name, index) => {
          html += `<button class="excel-tab ${index === 0 ? 'active' : ''}" data-sheet="${index}">${name}</button>`
        })
        html += '</div>'
      }

      // 为每个工作表生成HTML表格
      sheetNames.forEach((sheetName, index) => {
        const worksheet = workbook.Sheets[sheetName]

        if (!worksheet) {
          return
        }

        try {
          const htmlTable = XLSX.utils.sheet_to_html(worksheet, {
            id: `sheet-${index}`,
            editable: false,
            header: '',
            footer: '',
          })

          html += `<div class="excel-sheet ${index === 0 ? 'active' : ''}" data-sheet="${index}">`
          html += `<h3 class="sheet-title">${sheetName}</h3>`
          html += htmlTable
          html += '</div>'
        } catch (sheetError) {
          html += `<div class="excel-sheet ${index === 0 ? 'active' : ''}" data-sheet="${index}">`
          html += `<h3 class="sheet-title">${sheetName}</h3>`
          html += `<p>无法预览此工作表: ${sheetError.message}</p>`
          html += '</div>'
        }
      })

      html += '</div>'

      // 不在这里添加JavaScript，因为v-html不会执行脚本
      // 标签页切换逻辑将在前端Vue组件中处理

      return {
        html,
        fileInfo,
      }
    } catch (error) {
      throw new FileProcessingException(`Excel文档预览生成失败: ${error.message}`)
    }
  }

  private determinePreviewType(mimeType: string, filename: string): string {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'
    if (mimeType === 'application/pdf') return 'pdf'

    const ext = filename.split('.').pop()?.toLowerCase()

    // 文本文件
    if (mimeType.startsWith('text/') || ['txt', 'md', 'log'].includes(ext)) {
      return 'text'
    }

    // 代码文件
    if (
      [
        'js',
        'ts',
        'vue',
        'html',
        'css',
        'scss',
        'json',
        'xml',
        'py',
        'java',
        'cpp',
        'c',
        'php',
        'rb',
        'go',
        'rs',
        'sql',
        'yaml',
        'yml',
      ].includes(ext)
    ) {
      return 'code'
    }

    // Word文档
    if (['doc', 'docx'].includes(ext)) {
      return 'word'
    }

    // Excel文档
    if (['xls', 'xlsx'].includes(ext)) {
      return 'excel'
    }

    // 其他Office文档
    if (['ppt', 'pptx'].includes(ext)) {
      return 'office'
    }

    return 'unsupported'
  }

  private async extractFileMetadata(fileInfo: any): Promise<any> {
    const metadata: any = {}

    if (fileInfo.mimeType.startsWith('image/')) {
      // 对于图片，可以提取尺寸信息
      // 这里简化实现，实际应该使用图片处理库
      metadata.dimensions = { width: 0, height: 0 }
    }

    if (fileInfo.mimeType.startsWith('video/') || fileInfo.mimeType.startsWith('audio/')) {
      // 对于音视频，可以提取时长信息
      // 这里简化实现，实际应该使用ffmpeg等工具
      metadata.duration = 0
    }

    if (fileInfo.mimeType === 'application/pdf') {
      // 对于PDF，可以提取页数
      metadata.pages = 1
    }

    const ext = fileInfo.originalName.split('.').pop()?.toLowerCase()
    if (
      [
        'js',
        'ts',
        'vue',
        'html',
        'css',
        'scss',
        'json',
        'xml',
        'py',
        'java',
        'cpp',
        'c',
        'php',
        'rb',
        'go',
        'rs',
        'sql',
        'yaml',
        'yml',
      ].includes(ext)
    ) {
      metadata.language = ext
    }

    return metadata
  }
}
