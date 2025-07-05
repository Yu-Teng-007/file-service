import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  IsDateString,
  Min,
  Max,
} from 'class-validator'
import { Transform, Type } from 'class-transformer'
import { FileCategory, FileAccessLevel } from './file.types'

export class FileUploadDto {
  @ApiPropertyOptional({
    enum: FileCategory,
    description: '文件分类，如果不指定将根据文件类型自动判断',
  })
  @IsOptional()
  @IsEnum(FileCategory)
  category?: FileCategory

  @ApiPropertyOptional({
    enum: FileAccessLevel,
    description: '访问级别',
    default: FileAccessLevel.PUBLIC,
  })
  @IsOptional()
  @IsEnum(FileAccessLevel)
  accessLevel?: FileAccessLevel = FileAccessLevel.PUBLIC

  @ApiPropertyOptional({
    description: '自定义存储路径',
  })
  @IsOptional()
  @IsString()
  customPath?: string

  @ApiPropertyOptional({
    description: '是否覆盖同名文件',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  overwrite?: boolean = false

  @ApiPropertyOptional({
    description: '文件元数据（JSON字符串）',
  })
  @IsOptional()
  @IsString()
  metadata?: string

  @ApiPropertyOptional({
    description: '文件夹ID',
  })
  @IsOptional()
  @IsString()
  folderId?: string
}

export class FileSearchDto {
  @ApiPropertyOptional({
    enum: FileCategory,
    description: '按文件分类筛选',
  })
  @IsOptional()
  @IsEnum(FileCategory)
  category?: FileCategory

  @ApiPropertyOptional({
    enum: FileAccessLevel,
    description: '按访问级别筛选',
  })
  @IsOptional()
  @IsEnum(FileAccessLevel)
  accessLevel?: FileAccessLevel

  @ApiPropertyOptional({
    description: '按上传者筛选',
  })
  @IsOptional()
  @IsString()
  uploadedBy?: string

  @ApiPropertyOptional({
    description: '按文件名搜索（支持模糊匹配）',
  })
  @IsOptional()
  @IsString()
  filename?: string

  @ApiPropertyOptional({
    description: '按原始文件名搜索（支持模糊匹配）',
  })
  @IsOptional()
  @IsString()
  originalName?: string

  @ApiPropertyOptional({
    description: '通用搜索（同时搜索文件名和原始文件名）',
  })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    description: '开始日期（ISO格式）',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string

  @ApiPropertyOptional({
    description: '结束日期（ISO格式）',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string

  @ApiPropertyOptional({
    description: '最小文件大小（字节）',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minSize?: number

  @ApiPropertyOptional({
    description: '最大文件大小（字节）',
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  maxSize?: number

  @ApiPropertyOptional({
    description: '按MIME类型筛选',
  })
  @IsOptional()
  @IsString()
  mimeType?: string

  @ApiPropertyOptional({
    description: '按文件夹筛选',
  })
  @IsOptional()
  @IsString()
  folderId?: string

  @ApiPropertyOptional({
    description: '页码',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1

  @ApiPropertyOptional({
    description: '每页数量',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20

  @ApiPropertyOptional({
    enum: ['name', 'size', 'date', 'category'],
    description: '排序字段',
    default: 'date',
  })
  @IsOptional()
  @IsString()
  sortBy?: 'name' | 'size' | 'date' | 'category' = 'date'

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    description: '排序方向',
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc'
}

export class FileBatchOperationDto {
  @ApiProperty({
    enum: ['delete', 'move', 'copy', 'changeAccess'],
    description: '批量操作类型',
  })
  @IsEnum(['delete', 'move', 'copy', 'changeAccess'])
  action: 'delete' | 'move' | 'copy' | 'changeAccess'

  @ApiProperty({
    type: [String],
    description: '文件ID列表',
  })
  @IsArray()
  @IsString({ each: true })
  fileIds: string[]

  @ApiPropertyOptional({
    enum: FileCategory,
    description: '目标分类（移动/复制操作时需要）',
  })
  @IsOptional()
  @IsEnum(FileCategory)
  targetCategory?: FileCategory

  @ApiPropertyOptional({
    enum: FileAccessLevel,
    description: '目标访问级别（更改访问权限时需要）',
  })
  @IsOptional()
  @IsEnum(FileAccessLevel)
  targetAccessLevel?: FileAccessLevel
}

export class FileUpdateDto {
  @ApiPropertyOptional({
    description: '新的文件名（不包含扩展名）',
  })
  @IsOptional()
  @IsString()
  filename?: string

  @ApiPropertyOptional({
    enum: FileAccessLevel,
    description: '访问级别',
  })
  @IsOptional()
  @IsEnum(FileAccessLevel)
  accessLevel?: FileAccessLevel

  @ApiPropertyOptional({
    description: '文件元数据（JSON字符串）',
  })
  @IsOptional()
  @IsString()
  metadata?: string
}

export class FileResponseDto {
  @ApiProperty({ description: '文件ID' })
  id: string

  @ApiProperty({ description: '原始文件名' })
  originalName: string

  @ApiProperty({ description: '存储文件名' })
  filename: string

  @ApiProperty({ description: '文件路径' })
  path: string

  @ApiProperty({ description: '访问URL' })
  url: string

  @ApiProperty({ enum: FileCategory, description: '文件分类' })
  category: FileCategory

  @ApiProperty({ enum: FileAccessLevel, description: '访问级别' })
  accessLevel: FileAccessLevel

  @ApiProperty({ description: '文件大小（字节）' })
  size: number

  @ApiProperty({ description: 'MIME类型' })
  mimeType: string

  @ApiPropertyOptional({ description: '上传者' })
  uploadedBy?: string

  @ApiProperty({ description: '上传时间' })
  uploadedAt: Date

  @ApiPropertyOptional({ description: '所属文件夹ID' })
  folderId?: string

  @ApiPropertyOptional({ description: '文件元数据' })
  metadata?: Record<string, any>

  @ApiPropertyOptional({ description: '文件校验和' })
  checksum?: string
}

export class FileListResponseDto {
  @ApiProperty({ type: [FileResponseDto], description: '文件列表' })
  files: FileResponseDto[]

  @ApiProperty({ description: '总数量' })
  total: number

  @ApiProperty({ description: '当前页码' })
  page: number

  @ApiProperty({ description: '每页数量' })
  limit: number

  @ApiProperty({ description: '总页数' })
  totalPages: number
}

export class FileStatsResponseDto {
  @ApiProperty({ description: '文件总数' })
  totalFiles: number

  @ApiProperty({ description: '总大小（字节）' })
  totalSize: number

  @ApiProperty({ description: '各分类文件数量' })
  categoryCounts: Record<FileCategory, number>

  @ApiProperty({ description: '各分类总大小' })
  categorySizes: Record<FileCategory, number>

  @ApiProperty({ description: '各访问级别文件数量' })
  accessLevelCounts: Record<FileAccessLevel, number>
}

export class ApiResponseDto<T = any> {
  @ApiProperty({ description: '操作是否成功' })
  success: boolean

  @ApiProperty({ description: '响应消息' })
  message: string

  @ApiPropertyOptional({ description: '响应数据' })
  data?: T

  @ApiPropertyOptional({ description: '错误信息' })
  error?: string
}

// ==================== 文件夹相关 DTO ====================

export class CreateFolderDto {
  @ApiProperty({ description: '文件夹名称' })
  @IsString()
  name: string

  @ApiPropertyOptional({ description: '父文件夹ID' })
  @IsOptional()
  @IsString()
  parentId?: string

  @ApiPropertyOptional({ description: '自定义路径' })
  @IsOptional()
  @IsString()
  path?: string
}

export class UpdateFolderDto {
  @ApiPropertyOptional({ description: '文件夹名称' })
  @IsOptional()
  @IsString()
  name?: string
}

export class FolderResponseDto {
  @ApiProperty({ description: '文件夹ID' })
  id: string

  @ApiProperty({ description: '文件夹名称' })
  name: string

  @ApiProperty({ description: '文件夹路径' })
  path: string

  @ApiPropertyOptional({ description: '父文件夹ID' })
  parentId?: string

  @ApiProperty({ description: '文件数量' })
  fileCount: number

  @ApiProperty({ description: '总大小（字节）' })
  totalSize: number

  @ApiProperty({ description: '创建时间' })
  createdAt: string

  @ApiProperty({ description: '更新时间' })
  updatedAt: string
}

// ==================== 回收站相关 DTO ====================

export class TrashItemResponseDto {
  @ApiProperty({ description: '回收站项目ID' })
  id: string

  @ApiProperty({ description: '原始文件信息' })
  originalFileInfo: any

  @ApiProperty({ description: '删除时间' })
  deletedAt: string

  @ApiPropertyOptional({ description: '删除者' })
  deletedBy?: string

  @ApiProperty({ description: '原始路径' })
  originalPath: string
}

// ==================== 标签相关 DTO ====================

export class CreateTagDto {
  @ApiProperty({ description: '标签名称' })
  @IsString()
  name: string

  @ApiProperty({ description: '标签颜色（十六进制）' })
  @IsString()
  color: string

  @ApiPropertyOptional({ description: '标签描述' })
  @IsOptional()
  @IsString()
  description?: string
}

export class UpdateTagDto {
  @ApiPropertyOptional({ description: '标签名称' })
  @IsOptional()
  @IsString()
  name?: string

  @ApiPropertyOptional({ description: '标签颜色（十六进制）' })
  @IsOptional()
  @IsString()
  color?: string

  @ApiPropertyOptional({ description: '标签描述' })
  @IsOptional()
  @IsString()
  description?: string
}

export class TagResponseDto {
  @ApiProperty({ description: '标签ID' })
  id: string

  @ApiProperty({ description: '标签名称' })
  name: string

  @ApiProperty({ description: '标签颜色' })
  color: string

  @ApiPropertyOptional({ description: '标签描述' })
  description?: string

  @ApiProperty({ description: '创建时间' })
  createdAt: string

  @ApiProperty({ description: '更新时间' })
  updatedAt: string
}

export interface TrashStatsResponseDto {
  totalFiles: number
  totalSize: number
  oldestFile?: string
  newestFile?: string
}
