import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { promises as fs } from 'fs'

import { FileValidationService } from './file-validation.service'
import { FileStorageService } from './file-storage.service'
import { CacheService } from '../cache/cache.service'
import {
  UploadedFileInfo,
  FileSearchQuery,
  FileBatchOperation,
  FileStats,
} from '../../types/file.types'
import {
  FileUploadDto,
  FileSearchDto,
  FileBatchOperationDto,
  FileUpdateDto,
  FileResponseDto,
  FileListResponseDto,
  FileStatsResponseDto,
} from '../../types/dto'

@Injectable()
export class FilesService {
  constructor(
    private readonly configService: ConfigService,
    private readonly validationService: FileValidationService,
    private readonly storageService: FileStorageService,
    private readonly cacheService: CacheService
  ) {}

  /**
   * 上传单个文件
   */
  async uploadFile(file: Express.Multer.File, uploadDto: FileUploadDto): Promise<FileResponseDto> {
    if (!file) {
      throw new BadRequestException('请选择要上传的文件')
    }

    // 验证文件
    const validation = await this.validationService.validateFile(file)
    if (!validation.isValid) {
      // 清理临时文件
      await this.cleanupTempFile(file.path)
      throw new BadRequestException(`文件验证失败: ${validation.errors.join(', ')}`)
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
      dateFrom: searchDto.dateFrom ? new Date(searchDto.dateFrom) : undefined,
      dateTo: searchDto.dateTo ? new Date(searchDto.dateTo) : undefined,
      minSize: searchDto.minSize,
      maxSize: searchDto.maxSize,
      mimeType: searchDto.mimeType,
      page: searchDto.page,
      limit: searchDto.limit,
      sortBy: searchDto.sortBy,
      sortOrder: searchDto.sortOrder,
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
      throw new NotFoundException('文件不存在')
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
    if (metadata) updates.metadata = metadata

    const fileInfo = await this.storageService.updateFileInfo(id, updates)
    return this.mapToResponseDto(fileInfo)
  }

  /**
   * 删除文件
   */
  async deleteFile(id: string): Promise<void> {
    await this.storageService.deleteFile(id)
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
      console.warn(`清理临时文件失败: ${filePath}`, error)
    }
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
      metadata: fileInfo.metadata,
      checksum: fileInfo.checksum,
    }
  }
}
