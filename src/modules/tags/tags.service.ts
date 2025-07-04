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
import {
  CreateTagDto,
  UpdateTagDto,
  TagResponseDto,
} from '../../types/dto'

interface Tag {
  id: string
  name: string
  color: string
  description?: string
  createdAt: string
  updatedAt: string
}

interface FileTagRelation {
  fileId: string
  tagId: string
  createdAt: string
}

@Injectable()
export class TagsService {
  private readonly tagsFile: string
  private readonly fileTagsFile: string
  private readonly uploadDir: string

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || 'uploads'
    this.tagsFile = join(this.uploadDir, 'tags.json')
    this.fileTagsFile = join(this.uploadDir, 'file-tags.json')
    this.initializeFiles()
  }

  private async initializeFiles() {
    try {
      await fs.access(this.tagsFile)
    } catch {
      await fs.writeFile(this.tagsFile, JSON.stringify([], null, 2))
    }

    try {
      await fs.access(this.fileTagsFile)
    } catch {
      await fs.writeFile(this.fileTagsFile, JSON.stringify([], null, 2))
    }
  }

  private async loadTags(): Promise<Tag[]> {
    try {
      const data = await fs.readFile(this.tagsFile, 'utf-8')
      return JSON.parse(data)
    } catch {
      return []
    }
  }

  private async saveTags(tags: Tag[]): Promise<void> {
    await fs.writeFile(this.tagsFile, JSON.stringify(tags, null, 2))
  }

  private async loadFileTagRelations(): Promise<FileTagRelation[]> {
    try {
      const data = await fs.readFile(this.fileTagsFile, 'utf-8')
      return JSON.parse(data)
    } catch {
      return []
    }
  }

  private async saveFileTagRelations(relations: FileTagRelation[]): Promise<void> {
    await fs.writeFile(this.fileTagsFile, JSON.stringify(relations, null, 2))
  }

  private validateTagName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new BadRequestException('标签名称不能为空')
    }

    if (name.length > 50) {
      throw new BadRequestException('标签名称长度不能超过50个字符')
    }

    if (!/^[\u4e00-\u9fa5a-zA-Z0-9\s\-_]+$/.test(name)) {
      throw new BadRequestException('标签名称只能包含中文、英文、数字、空格、连字符和下划线')
    }
  }

  private validateTagColor(color: string): void {
    if (!color) {
      throw new BadRequestException('标签颜色不能为空')
    }

    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      throw new BadRequestException('标签颜色格式不正确，请使用十六进制颜色代码（如 #FF0000）')
    }
  }

  async getAllTags(): Promise<TagResponseDto[]> {
    const tags = await this.loadTags()
    return tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      description: tag.description,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    }))
  }

  async getTagById(id: string): Promise<TagResponseDto> {
    const tags = await this.loadTags()
    const tag = tags.find(t => t.id === id)

    if (!tag) {
      throw new NotFoundException('标签不存在')
    }

    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      description: tag.description,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    }
  }

  async createTag(createTagDto: CreateTagDto): Promise<TagResponseDto> {
    const { name, color, description } = createTagDto

    this.validateTagName(name)
    this.validateTagColor(color)

    const tags = await this.loadTags()

    // 检查标签名称是否已存在
    const existingTag = tags.find(t => t.name.toLowerCase() === name.toLowerCase())
    if (existingTag) {
      throw new ConflictException('标签名称已存在')
    }

    const now = new Date().toISOString()
    const newTag: Tag = {
      id: uuidv4(),
      name: name.trim(),
      color,
      description: description?.trim(),
      createdAt: now,
      updatedAt: now,
    }

    tags.push(newTag)
    await this.saveTags(tags)

    return {
      id: newTag.id,
      name: newTag.name,
      color: newTag.color,
      description: newTag.description,
      createdAt: newTag.createdAt,
      updatedAt: newTag.updatedAt,
    }
  }

  async updateTag(id: string, updateTagDto: UpdateTagDto): Promise<TagResponseDto> {
    const { name, color, description } = updateTagDto

    if (name) this.validateTagName(name)
    if (color) this.validateTagColor(color)

    const tags = await this.loadTags()
    const tagIndex = tags.findIndex(t => t.id === id)

    if (tagIndex === -1) {
      throw new NotFoundException('标签不存在')
    }

    // 检查标签名称是否与其他标签重复
    if (name) {
      const existingTag = tags.find(t => 
        t.name.toLowerCase() === name.toLowerCase() && t.id !== id
      )
      if (existingTag) {
        throw new ConflictException('标签名称已存在')
      }
    }

    const tag = tags[tagIndex]
    const updatedTag: Tag = {
      ...tag,
      name: name ? name.trim() : tag.name,
      color: color || tag.color,
      description: description !== undefined ? description?.trim() : tag.description,
      updatedAt: new Date().toISOString(),
    }

    tags[tagIndex] = updatedTag
    await this.saveTags(tags)

    return {
      id: updatedTag.id,
      name: updatedTag.name,
      color: updatedTag.color,
      description: updatedTag.description,
      createdAt: updatedTag.createdAt,
      updatedAt: updatedTag.updatedAt,
    }
  }

  async deleteTag(id: string): Promise<void> {
    const tags = await this.loadTags()
    const tagIndex = tags.findIndex(t => t.id === id)

    if (tagIndex === -1) {
      throw new NotFoundException('标签不存在')
    }

    // 删除标签
    tags.splice(tagIndex, 1)
    await this.saveTags(tags)

    // 删除所有文件与此标签的关联
    const relations = await this.loadFileTagRelations()
    const filteredRelations = relations.filter(r => r.tagId !== id)
    await this.saveFileTagRelations(filteredRelations)
  }

  async addTagsToFile(fileId: string, tagIds: string[]): Promise<void> {
    // 验证标签是否存在
    const tags = await this.loadTags()
    const validTagIds = tags.map(t => t.id)
    const invalidTagIds = tagIds.filter(id => !validTagIds.includes(id))

    if (invalidTagIds.length > 0) {
      throw new NotFoundException(`以下标签不存在: ${invalidTagIds.join(', ')}`)
    }

    const relations = await this.loadFileTagRelations()
    const now = new Date().toISOString()

    // 添加新的关联关系（避免重复）
    for (const tagId of tagIds) {
      const existingRelation = relations.find(r => 
        r.fileId === fileId && r.tagId === tagId
      )

      if (!existingRelation) {
        relations.push({
          fileId,
          tagId,
          createdAt: now,
        })
      }
    }

    await this.saveFileTagRelations(relations)
  }

  async removeTagsFromFile(fileId: string, tagIds: string[]): Promise<void> {
    const relations = await this.loadFileTagRelations()
    
    // 移除指定的关联关系
    const filteredRelations = relations.filter(r => 
      !(r.fileId === fileId && tagIds.includes(r.tagId))
    )

    await this.saveFileTagRelations(filteredRelations)
  }

  async getFileTags(fileId: string): Promise<TagResponseDto[]> {
    const relations = await this.loadFileTagRelations()
    const tags = await this.loadTags()

    const fileTagIds = relations
      .filter(r => r.fileId === fileId)
      .map(r => r.tagId)

    const fileTags = tags.filter(t => fileTagIds.includes(t.id))

    return fileTags.map(tag => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      description: tag.description,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    }))
  }

  async getTagFiles(tagId: string): Promise<string[]> {
    // 验证标签是否存在
    const tags = await this.loadTags()
    const tagExists = tags.some(t => t.id === tagId)

    if (!tagExists) {
      throw new NotFoundException('标签不存在')
    }

    const relations = await this.loadFileTagRelations()
    return relations
      .filter(r => r.tagId === tagId)
      .map(r => r.fileId)
  }

  async getFilesByTags(tagIds: string[]): Promise<string[]> {
    const relations = await this.loadFileTagRelations()
    
    // 获取包含任一指定标签的文件
    const fileIds = new Set<string>()
    
    for (const relation of relations) {
      if (tagIds.includes(relation.tagId)) {
        fileIds.add(relation.fileId)
      }
    }

    return Array.from(fileIds)
  }
}
