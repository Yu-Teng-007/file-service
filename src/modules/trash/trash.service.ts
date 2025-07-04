import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { join, dirname } from 'path'
import { promises as fs } from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { TrashItemResponseDto, TrashStatsResponseDto } from '../../types/dto'
import { FileStorageService } from '../files/file-storage.service'

interface TrashItem {
  id: string
  originalFileInfo: any
  deletedAt: string
  deletedBy?: string
  originalPath: string
  physicalPath: string
}

@Injectable()
export class TrashService {
  private readonly trashFile: string
  private readonly trashDir: string
  private readonly uploadDir: string

  constructor(
    private readonly configService: ConfigService,
    private readonly fileStorageService: FileStorageService
  ) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || 'uploads'
    this.trashDir = join(this.uploadDir, 'trash')
    this.trashFile = join(this.trashDir, 'trash.json')
    this.initializeTrash()
  }

  private async initializeTrash() {
    try {
      // 确保回收站目录存在
      await fs.mkdir(this.trashDir, { recursive: true })

      // 检查回收站文件是否存在
      await fs.access(this.trashFile)
    } catch {
      // 文件不存在，创建初始文件
      await fs.writeFile(this.trashFile, JSON.stringify([], null, 2))
    }
  }

  private async loadTrashItems(): Promise<TrashItem[]> {
    try {
      const data = await fs.readFile(this.trashFile, 'utf-8')
      return JSON.parse(data)
    } catch {
      return []
    }
  }

  private async saveTrashItems(items: TrashItem[]): Promise<void> {
    await fs.writeFile(this.trashFile, JSON.stringify(items, null, 2))
  }

  async getTrashFiles(): Promise<TrashItemResponseDto[]> {
    const trashItems = await this.loadTrashItems()

    return trashItems.map(item => ({
      id: item.id,
      originalFileInfo: item.originalFileInfo,
      deletedAt: item.deletedAt,
      deletedBy: item.deletedBy,
      originalPath: item.originalPath,
    }))
  }

  async moveToTrash(fileInfo: any, deletedBy?: string): Promise<string> {
    const trashItems = await this.loadTrashItems()

    const trashId = uuidv4()
    const now = new Date().toISOString()

    // 生成回收站中的物理路径
    const ext = fileInfo.filename ? fileInfo.filename.split('.').pop() : ''
    const trashFileName = `${trashId}${ext ? '.' + ext : ''}`
    const trashPhysicalPath = join(this.trashDir, trashFileName)

    const trashItem: TrashItem = {
      id: trashId,
      originalFileInfo: fileInfo,
      deletedAt: now,
      deletedBy,
      originalPath: fileInfo.path || '',
      physicalPath: trashPhysicalPath,
    }

    try {
      // 移动文件到回收站
      if (fileInfo.path) {
        await fs.rename(fileInfo.path, trashPhysicalPath)
      }

      // 保存回收站记录
      trashItems.push(trashItem)
      await this.saveTrashItems(trashItems)

      return trashId
    } catch (error) {
      throw new InternalServerErrorException(`移动文件到回收站失败: ${error.message}`)
    }
  }

  async restoreFiles(fileIds: string[]): Promise<number> {
    const trashItems = await this.loadTrashItems()
    let restoredCount = 0

    for (const fileId of fileIds) {
      const itemIndex = trashItems.findIndex(item => item.id === fileId)

      if (itemIndex === -1) {
        console.warn(`回收站中未找到文件: ${fileId}`)
        continue
      }

      const item = trashItems[itemIndex]

      try {
        // 恢复文件到原始位置
        if (item.originalFileInfo.path && item.physicalPath) {
          // 使用 dirname 获取目标目录，这样可以正确处理跨平台路径
          const targetDir = dirname(item.originalFileInfo.path)
          if (targetDir && targetDir !== '.' && targetDir !== item.originalFileInfo.path) {
            await fs.mkdir(targetDir, { recursive: true })
          }

          // 移动文件回原位置
          await fs.rename(item.physicalPath, item.originalFileInfo.path)
        }

        // 恢复文件元数据到存储服务
        await this.fileStorageService.restoreFileMetadata(item.originalFileInfo)

        // 从回收站记录中移除
        trashItems.splice(itemIndex, 1)
        restoredCount++
      } catch (error) {
        console.error(`恢复文件失败: ${fileId}`, error)
        // 如果恢复失败，不要从回收站中移除该项目
      }
    }

    await this.saveTrashItems(trashItems)
    return restoredCount
  }

  async permanentDeleteFiles(fileIds: string[]): Promise<number> {
    const trashItems = await this.loadTrashItems()
    let deletedCount = 0

    for (const fileId of fileIds) {
      const itemIndex = trashItems.findIndex(item => item.id === fileId)

      if (itemIndex === -1) {
        console.warn(`回收站中未找到文件: ${fileId}`)
        continue
      }

      const item = trashItems[itemIndex]

      try {
        // 永久删除物理文件
        if (item.physicalPath) {
          await fs.unlink(item.physicalPath)
        }

        // 从回收站记录中移除
        trashItems.splice(itemIndex, 1)
        deletedCount++
      } catch (error) {
        console.error(`永久删除文件失败: ${fileId}`, error)
      }
    }

    await this.saveTrashItems(trashItems)
    return deletedCount
  }

  async emptyTrash(): Promise<number> {
    const trashItems = await this.loadTrashItems()
    let deletedCount = 0

    for (const item of trashItems) {
      try {
        // 删除物理文件
        if (item.physicalPath) {
          await fs.unlink(item.physicalPath)
        }
        deletedCount++
      } catch (error) {
        console.error(`删除文件失败: ${item.id}`, error)
      }
    }

    // 清空回收站记录
    await this.saveTrashItems([])
    return deletedCount
  }

  async getTrashStats(): Promise<TrashStatsResponseDto> {
    const trashItems = await this.loadTrashItems()

    if (trashItems.length === 0) {
      return {
        totalFiles: 0,
        totalSize: 0,
      }
    }

    let totalSize = 0
    let oldestDate: string | undefined
    let newestDate: string | undefined

    for (const item of trashItems) {
      // 计算文件大小
      try {
        if (item.physicalPath) {
          const stats = await fs.stat(item.physicalPath)
          totalSize += stats.size
        }
      } catch {
        // 忽略无法访问的文件
      }

      // 找出最早和最晚的删除时间
      if (!oldestDate || item.deletedAt < oldestDate) {
        oldestDate = item.deletedAt
      }
      if (!newestDate || item.deletedAt > newestDate) {
        newestDate = item.deletedAt
      }
    }

    return {
      totalFiles: trashItems.length,
      totalSize,
      oldestFile: oldestDate,
      newestFile: newestDate,
    }
  }

  async cleanupExpiredFiles(days: number): Promise<number> {
    const trashItems = await this.loadTrashItems()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const expiredItems = trashItems.filter(item => new Date(item.deletedAt) < cutoffDate)

    if (expiredItems.length === 0) {
      return 0
    }

    const expiredIds = expiredItems.map(item => item.id)
    return await this.permanentDeleteFiles(expiredIds)
  }

  async isInTrash(fileId: string): Promise<boolean> {
    const trashItems = await this.loadTrashItems()
    return trashItems.some(item => item.originalFileInfo.id === fileId)
  }
}
