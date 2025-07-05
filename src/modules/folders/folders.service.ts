import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { join } from 'path'
import { promises as fs } from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { CreateFolderDto, UpdateFolderDto, FolderResponseDto } from '../../dto'
import { FileStorageService } from '../files/file-storage.service'

interface FolderInfo {
  id: string
  name: string
  path: string
  parentId?: string
  children?: FolderInfo[]
  fileCount: number
  totalSize: number
  createdAt: string
  updatedAt: string
}

@Injectable()
export class FoldersService {
  private readonly foldersFile: string
  private readonly uploadDir: string

  constructor(
    private readonly configService: ConfigService,
    private readonly fileStorageService: FileStorageService
  ) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || 'uploads'
    this.foldersFile = join(this.uploadDir, 'folders.json')
    this.initializeFoldersFile()
  }

  private async initializeFoldersFile() {
    try {
      await fs.access(this.foldersFile)
    } catch {
      // 文件不存在，创建初始文件
      await fs.writeFile(this.foldersFile, JSON.stringify([], null, 2))
    }
  }

  private async loadFolders(): Promise<FolderInfo[]> {
    try {
      const data = await fs.readFile(this.foldersFile, 'utf-8')
      return JSON.parse(data)
    } catch {
      return []
    }
  }

  private async saveFolders(folders: FolderInfo[]): Promise<void> {
    await fs.writeFile(this.foldersFile, JSON.stringify(folders, null, 2))
  }

  private buildFolderPath(parentId?: string, folders?: FolderInfo[]): string {
    if (!parentId) return '/'

    if (!folders) {
      // 如果没有提供folders，需要加载
      return '/' // 简化处理，实际应该递归构建路径
    }

    const parent = folders.find(f => f.id === parentId)
    if (!parent) return '/'

    const parentPath = this.buildFolderPath(parent.parentId, folders)
    return parentPath === '/' ? `/${parent.name}` : `${parentPath}/${parent.name}`
  }

  private async calculateFolderStats(
    folderId: string
  ): Promise<{ fileCount: number; totalSize: number }> {
    try {
      // 读取文件元数据来计算统计信息
      const metadataPath = join(this.uploadDir, 'metadata.json')

      let fileMetadata: any = {}
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8')
        fileMetadata = JSON.parse(metadataContent)
      } catch (error) {
        // 如果元数据文件不存在或读取失败，返回默认值
        return { fileCount: 0, totalSize: 0 }
      }

      // 统计属于该文件夹的文件
      let fileCount = 0
      let totalSize = 0

      for (const [fileId, metadata] of Object.entries(fileMetadata)) {
        const file = metadata as any
        if (file.folderId === folderId) {
          fileCount++
          totalSize += file.size || 0
        }
      }

      return { fileCount, totalSize }
    } catch (error) {
      console.error(`计算文件夹统计信息失败: ${folderId}`, error)
      return { fileCount: 0, totalSize: 0 }
    }
  }

  private async calculateAllFilesStats(): Promise<{ fileCount: number; totalSize: number }> {
    try {
      // 读取文件元数据来计算所有文件的统计信息
      const metadataPath = join(this.uploadDir, 'metadata.json')

      let fileMetadata: any = {}
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8')
        fileMetadata = JSON.parse(metadataContent)
      } catch (error) {
        // 如果元数据文件不存在或读取失败，返回默认值
        return { fileCount: 0, totalSize: 0 }
      }

      // 统计所有文件
      let fileCount = 0
      let totalSize = 0

      for (const [fileId, metadata] of Object.entries(fileMetadata)) {
        const file = metadata as any
        fileCount++
        totalSize += file.size || 0
      }

      return { fileCount, totalSize }
    } catch (error) {
      console.error('计算所有文件统计信息失败:', error)
      return { fileCount: 0, totalSize: 0 }
    }
  }

  async getFolders(parentId?: string, includeFiles?: boolean): Promise<FolderResponseDto[]> {
    const folders = await this.loadFolders()

    let filteredFolders = folders
    if (parentId) {
      filteredFolders = folders.filter(f => f.parentId === parentId)
    }

    // 默认包含文件统计信息，除非明确设置为false
    const shouldIncludeFiles = includeFiles !== false

    const result: FolderResponseDto[] = []

    // 如果没有指定父文件夹，确保存在系统【全部】文件夹
    if (!parentId) {
      // 检查是否已经存在"全部"文件夹
      const existingAllFolder = filteredFolders.find(f => f.id === 'all')

      if (existingAllFolder) {
        // 如果已存在，更新其统计信息
        const allFolderStats = shouldIncludeFiles
          ? await this.calculateAllFilesStats()
          : { fileCount: 0, totalSize: 0 }

        result.push({
          id: existingAllFolder.id,
          name: existingAllFolder.name,
          path: existingAllFolder.path,
          parentId: existingAllFolder.parentId,
          fileCount: allFolderStats.fileCount,
          totalSize: allFolderStats.totalSize,
          createdAt: existingAllFolder.createdAt,
          updatedAt: existingAllFolder.updatedAt,
          isSystem: true,
        })

        // 从 filteredFolders 中移除，避免重复添加
        filteredFolders = filteredFolders.filter(f => f.id !== 'all')
      } else {
        // 如果不存在，创建新的"全部"文件夹
        const allFolderStats = shouldIncludeFiles
          ? await this.calculateAllFilesStats()
          : { fileCount: 0, totalSize: 0 }

        result.push({
          id: 'all',
          name: '全部',
          path: '/',
          parentId: null,
          fileCount: allFolderStats.fileCount,
          totalSize: allFolderStats.totalSize,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isSystem: true,
        })
      }
    }

    for (const folder of filteredFolders) {
      const stats = shouldIncludeFiles
        ? await this.calculateFolderStats(folder.id)
        : { fileCount: 0, totalSize: 0 }

      result.push({
        id: folder.id,
        name: folder.name,
        path: folder.path,
        parentId: folder.parentId,
        fileCount: stats.fileCount,
        totalSize: stats.totalSize,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
        isSystem: false,
      })
    }

    return result
  }

  async getFolderById(id: string): Promise<FolderResponseDto> {
    // 处理系统文件夹【全部】
    if (id === 'all') {
      const allFolderStats = await this.calculateAllFilesStats()
      return {
        id: 'all',
        name: '全部',
        path: '/',
        parentId: null,
        fileCount: allFolderStats.fileCount,
        totalSize: allFolderStats.totalSize,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isSystem: true,
      }
    }

    const folders = await this.loadFolders()
    const folder = folders.find(f => f.id === id)

    if (!folder) {
      throw new NotFoundException('文件夹不存在')
    }

    const stats = await this.calculateFolderStats(id)

    return {
      id: folder.id,
      name: folder.name,
      path: folder.path,
      parentId: folder.parentId,
      fileCount: stats.fileCount,
      totalSize: stats.totalSize,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
      isSystem: false,
    }
  }

  async createFolder(createFolderDto: CreateFolderDto): Promise<FolderResponseDto> {
    const { name, parentId } = createFolderDto

    // 验证文件夹名称
    if (!name || name.trim().length === 0) {
      throw new BadRequestException('文件夹名称不能为空')
    }

    if (!/^[^<>:"/\\|?*]+$/.test(name)) {
      throw new BadRequestException('文件夹名称包含非法字符')
    }

    const folders = await this.loadFolders()

    // 检查父文件夹是否存在
    if (parentId) {
      const parentExists = folders.some(f => f.id === parentId)
      if (!parentExists) {
        throw new BadRequestException('父文件夹不存在')
      }
    }

    // 检查同级文件夹名称是否重复
    const duplicateExists = folders.some(f => f.name === name && f.parentId === parentId)
    if (duplicateExists) {
      throw new ConflictException('同级目录下已存在同名文件夹')
    }

    const now = new Date().toISOString()
    const folderId = uuidv4()
    const folderPath = this.buildFolderPath(parentId, folders)
    const fullPath = folderPath === '/' ? `/${name}` : `${folderPath}/${name}`

    const newFolder: FolderInfo = {
      id: folderId,
      name,
      path: fullPath,
      parentId,
      fileCount: 0,
      totalSize: 0,
      createdAt: now,
      updatedAt: now,
    }

    folders.push(newFolder)
    await this.saveFolders(folders)

    // 创建物理文件夹
    const physicalPath = join(this.uploadDir, 'folders', folderId)
    await fs.mkdir(physicalPath, { recursive: true })

    return {
      id: newFolder.id,
      name: newFolder.name,
      path: newFolder.path,
      parentId: newFolder.parentId,
      fileCount: newFolder.fileCount,
      totalSize: newFolder.totalSize,
      createdAt: newFolder.createdAt,
      updatedAt: newFolder.updatedAt,
      isSystem: false,
    }
  }

  async updateFolder(id: string, updateFolderDto: UpdateFolderDto): Promise<FolderResponseDto> {
    const { name } = updateFolderDto

    if (!name || name.trim().length === 0) {
      throw new BadRequestException('文件夹名称不能为空')
    }

    if (!/^[^<>:"/\\|?*]+$/.test(name)) {
      throw new BadRequestException('文件夹名称包含非法字符')
    }

    const folders = await this.loadFolders()
    const folderIndex = folders.findIndex(f => f.id === id)

    if (folderIndex === -1) {
      throw new NotFoundException('文件夹不存在')
    }

    const folder = folders[folderIndex]

    // 检查同级文件夹名称是否重复
    const duplicateExists = folders.some(
      f => f.name === name && f.parentId === folder.parentId && f.id !== id
    )
    if (duplicateExists) {
      throw new ConflictException('同级目录下已存在同名文件夹')
    }

    // 更新文件夹信息
    const oldPath = folder.path
    const parentPath = this.buildFolderPath(folder.parentId, folders)
    const newPath = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`

    folders[folderIndex] = {
      ...folder,
      name,
      path: newPath,
      updatedAt: new Date().toISOString(),
    }

    // 更新所有子文件夹的路径
    this.updateChildrenPaths(folders, id, oldPath, newPath)

    await this.saveFolders(folders)

    return {
      id: folders[folderIndex].id,
      name: folders[folderIndex].name,
      path: folders[folderIndex].path,
      parentId: folders[folderIndex].parentId,
      fileCount: folders[folderIndex].fileCount,
      totalSize: folders[folderIndex].totalSize,
      createdAt: folders[folderIndex].createdAt,
      updatedAt: folders[folderIndex].updatedAt,
      isSystem: false,
    }
  }

  private updateChildrenPaths(
    folders: FolderInfo[],
    parentId: string,
    oldParentPath: string,
    newParentPath: string
  ) {
    const children = folders.filter(f => f.parentId === parentId)

    for (const child of children) {
      const oldChildPath = child.path
      const newChildPath = oldChildPath.replace(oldParentPath, newParentPath)
      child.path = newChildPath
      child.updatedAt = new Date().toISOString()

      // 递归更新子文件夹
      this.updateChildrenPaths(folders, child.id, oldChildPath, newChildPath)
    }
  }

  async deleteFolder(id: string): Promise<void> {
    const folders = await this.loadFolders()
    const folderIndex = folders.findIndex(f => f.id === id)

    if (folderIndex === -1) {
      throw new NotFoundException('文件夹不存在')
    }

    const folder = folders[folderIndex]

    // 检查是否有子文件夹
    const hasChildren = folders.some(f => f.parentId === id)
    if (hasChildren) {
      throw new BadRequestException('文件夹包含子文件夹，请先删除所有子文件夹')
    }

    // 检查是否有文件
    const stats = await this.calculateFolderStats(id)
    if (stats.fileCount > 0) {
      throw new BadRequestException('文件夹包含文件，请先清空文件夹中的所有文件')
    }

    // 删除文件夹
    folders.splice(folderIndex, 1)
    await this.saveFolders(folders)

    // 删除物理文件夹
    const physicalPath = join(this.uploadDir, 'folders', id)
    try {
      await fs.rmdir(physicalPath, { recursive: true })
    } catch (error) {
      // 忽略物理删除错误
      console.warn(`Failed to delete physical folder: ${physicalPath}`, error)
    }
  }

  async getFolderFiles(folderId: string, page?: number, limit?: number) {
    try {
      // 读取文件元数据来获取文件夹中的文件
      const metadataPath = join(this.uploadDir, 'metadata.json')

      let fileMetadata: any = {}
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8')
        fileMetadata = JSON.parse(metadataContent)
      } catch (error) {
        // 如果元数据文件不存在或读取失败，返回空结果
        return {
          files: [],
          total: 0,
          page: page || 1,
          limit: limit || 20,
        }
      }

      // 筛选属于该文件夹的文件
      const folderFiles = []
      for (const [fileId, metadata] of Object.entries(fileMetadata)) {
        const file = metadata as any
        if (file.folderId === folderId) {
          folderFiles.push({
            id: fileId,
            ...file,
          })
        }
      }

      // 分页处理
      const pageNum = page || 1
      const pageSize = limit || 20
      const startIndex = (pageNum - 1) * pageSize
      const endIndex = startIndex + pageSize
      const paginatedFiles = folderFiles.slice(startIndex, endIndex)

      return {
        files: paginatedFiles,
        total: folderFiles.length,
        page: pageNum,
        limit: pageSize,
      }
    } catch (error) {
      console.error('获取文件夹文件列表失败:', error)
      return {
        files: [],
        total: 0,
        page: page || 1,
        limit: limit || 20,
      }
    }
  }

  /**
   * 刷新指定文件夹的统计信息
   */
  async refreshFolderStats(folderIds: string[]): Promise<void> {
    try {
      const folders = await this.loadFolders()
      let hasChanges = false

      for (const folderId of folderIds) {
        const folder = folders.find(f => f.id === folderId)
        if (folder) {
          const stats = await this.calculateFolderStats(folderId)

          // 只有当统计信息发生变化时才更新
          if (folder.fileCount !== stats.fileCount || folder.totalSize !== stats.totalSize) {
            folder.fileCount = stats.fileCount
            folder.totalSize = stats.totalSize
            folder.updatedAt = new Date().toISOString()
            hasChanges = true

            console.log(
              `更新文件夹统计: ${folder.name} - ${stats.fileCount} 个文件, ${stats.totalSize} 字节`
            )
          }
        }
      }

      // 如果有变化，保存文件夹数据
      if (hasChanges) {
        await this.saveFolders(folders)
        console.log(`已更新 ${folderIds.length} 个文件夹的统计信息`)
      }
    } catch (error) {
      console.error('刷新文件夹统计信息失败:', error)
      throw error
    }
  }

  /**
   * 刷新所有文件夹的统计信息
   */
  async refreshAllFolderStats(): Promise<void> {
    try {
      const folders = await this.loadFolders()
      let hasChanges = false

      for (const folder of folders) {
        // 跳过系统文件夹
        if (folder.id === 'all') {
          const stats = await this.calculateAllFilesStats()
          if (folder.fileCount !== stats.fileCount || folder.totalSize !== stats.totalSize) {
            folder.fileCount = stats.fileCount
            folder.totalSize = stats.totalSize
            folder.updatedAt = new Date().toISOString()
            hasChanges = true
          }
        } else {
          const stats = await this.calculateFolderStats(folder.id)
          if (folder.fileCount !== stats.fileCount || folder.totalSize !== stats.totalSize) {
            folder.fileCount = stats.fileCount
            folder.totalSize = stats.totalSize
            folder.updatedAt = new Date().toISOString()
            hasChanges = true
          }
        }
      }

      // 如果有变化，保存文件夹数据
      if (hasChanges) {
        await this.saveFolders(folders)
        console.log('已刷新所有文件夹的统计信息')
      }
    } catch (error) {
      console.error('刷新所有文件夹统计信息失败:', error)
      throw error
    }
  }

  async moveFilesToFolder(fileIds: string[], folderId: string): Promise<void> {
    // 验证文件夹是否存在
    const folders = await this.loadFolders()
    const folderExists = folders.some(f => f.id === folderId)

    if (!folderExists) {
      throw new NotFoundException('目标文件夹不存在')
    }

    // 确保目标文件夹的物理目录存在
    const targetFolderPath = join(this.uploadDir, 'folders', folderId)
    await fs.mkdir(targetFolderPath, { recursive: true })

    // 移动每个文件
    for (const fileId of fileIds) {
      try {
        await this.moveFileToFolder(fileId, folderId, targetFolderPath)
      } catch (error) {
        console.warn(`移动文件 ${fileId} 失败:`, error.message)
        // 继续处理其他文件，不抛出错误
      }
    }

    console.log(`Successfully moved ${fileIds.length} files to folder ${folderId}`)
  }

  private async moveFileToFolder(
    fileId: string,
    folderId: string,
    targetFolderPath: string
  ): Promise<void> {
    // 获取文件信息
    const fileInfo = await this.fileStorageService.getFileInfo(fileId)
    if (!fileInfo) {
      throw new NotFoundException(`文件 ${fileId} 不存在`)
    }

    // 构建新的文件路径
    const filename = fileInfo.filename
    const newFilePath = join(targetFolderPath, filename)

    // 移动物理文件
    if (fileInfo.path && fileInfo.path !== newFilePath) {
      try {
        await fs.access(fileInfo.path) // 检查源文件是否存在
        await fs.rename(fileInfo.path, newFilePath)
      } catch (error) {
        console.warn(`移动物理文件失败: ${fileInfo.path} -> ${newFilePath}`, error)
        // 如果物理文件移动失败，仍然更新元数据，但记录警告
      }
    }

    // 更新文件元数据
    const newUrl = `/uploads/folders/${folderId}/${filename}`
    await this.fileStorageService.updateFileInfo(fileId, {
      folderId,
      path: newFilePath,
      url: newUrl,
    })
  }
}
