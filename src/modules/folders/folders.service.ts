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
import { CreateFolderDto, UpdateFolderDto, FolderResponseDto } from '../../types/dto'
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

  async getFolders(parentId?: string, includeFiles?: boolean): Promise<FolderResponseDto[]> {
    const folders = await this.loadFolders()

    let filteredFolders = folders
    if (parentId) {
      filteredFolders = folders.filter(f => f.parentId === parentId)
    }

    // 默认包含文件统计信息，除非明确设置为false
    const shouldIncludeFiles = includeFiles !== false

    const result: FolderResponseDto[] = []
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
      })
    }

    return result
  }

  async getFolderById(id: string): Promise<FolderResponseDto> {
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

  async deleteFolder(id: string, force?: boolean): Promise<void> {
    const folders = await this.loadFolders()
    const folderIndex = folders.findIndex(f => f.id === id)

    if (folderIndex === -1) {
      throw new NotFoundException('文件夹不存在')
    }

    const folder = folders[folderIndex]

    // 检查是否有子文件夹
    const hasChildren = folders.some(f => f.parentId === id)
    if (hasChildren && !force) {
      throw new BadRequestException('文件夹不为空，无法删除。使用 force=true 强制删除')
    }

    // 检查是否有文件（这里需要实际查询文件系统或数据库）
    const stats = await this.calculateFolderStats(id)
    if (stats.fileCount > 0 && !force) {
      throw new BadRequestException('文件夹包含文件，无法删除。使用 force=true 强制删除')
    }

    if (force) {
      // 递归删除所有子文件夹
      await this.deleteChildrenFolders(folders, id)
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

  private async deleteChildrenFolders(folders: FolderInfo[], parentId: string) {
    const children = folders.filter(f => f.parentId === parentId)

    for (const child of children) {
      // 递归删除子文件夹的子文件夹
      await this.deleteChildrenFolders(folders, child.id)

      // 删除子文件夹
      const childIndex = folders.findIndex(f => f.id === child.id)
      if (childIndex !== -1) {
        folders.splice(childIndex, 1)
      }
    }
  }

  async getFolderFiles(folderId: string, page?: number, limit?: number) {
    // 这里应该查询文件数据库或文件系统
    // 简化实现，返回空数组
    return {
      files: [],
      total: 0,
      page: page || 1,
      limit: limit || 20,
    }
  }

  async moveFilesToFolder(fileIds: string[], folderId: string): Promise<void> {
    // 验证文件夹是否存在
    const folders = await this.loadFolders()
    const folderExists = folders.some(f => f.id === folderId)

    if (!folderExists) {
      throw new NotFoundException('目标文件夹不存在')
    }

    // 这里应该更新文件的文件夹关联
    // 简化实现，只做验证
    console.log(`Moving files ${fileIds.join(', ')} to folder ${folderId}`)
  }
}
