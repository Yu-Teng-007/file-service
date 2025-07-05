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
import { FileCategory, FileAccessLevel } from '../types/file.types'

/**
 * 文件上传DTO
 * File Upload DTO
 */
export class FileUploadDto {
  @ApiPropertyOptional({
    enum: FileCategory,
    description:
      '文件分类，如果不指定将根据文件类型自动判断 / File category, auto-detected if not specified',
  })
  @IsOptional()
  @IsEnum(FileCategory)
  category?: FileCategory

  @ApiPropertyOptional({
    enum: FileAccessLevel,
    description: '访问级别 / Access level',
    default: FileAccessLevel.PUBLIC,
  })
  @IsOptional()
  @IsEnum(FileAccessLevel)
  accessLevel?: FileAccessLevel = FileAccessLevel.PUBLIC

  @ApiPropertyOptional({
    description: '自定义存储路径 / Custom storage path',
  })
  @IsOptional()
  @IsString()
  customPath?: string

  @ApiPropertyOptional({
    description: '是否覆盖同名文件 / Whether to overwrite files with same name',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  overwrite?: boolean = false

  @ApiPropertyOptional({
    description: '文件元数据（JSON字符串）/ File metadata (JSON string)',
  })
  @IsOptional()
  @IsString()
  metadata?: string

  @ApiPropertyOptional({
    description: '文件夹ID / Folder ID',
  })
  @IsOptional()
  @IsString()
  folderId?: string
}

/**
 * 文件搜索DTO
 * File Search DTO
 */
export class FileSearchDto {
  @ApiPropertyOptional({
    enum: FileCategory,
    description: '按文件分类筛选 / Filter by file category',
  })
  @IsOptional()
  @IsEnum(FileCategory)
  category?: FileCategory

  @ApiPropertyOptional({
    enum: FileAccessLevel,
    description: '按访问级别筛选 / Filter by access level',
  })
  @IsOptional()
  @IsEnum(FileAccessLevel)
  accessLevel?: FileAccessLevel

  @ApiPropertyOptional({
    description: '按上传者筛选 / Filter by uploader',
  })
  @IsOptional()
  @IsString()
  uploadedBy?: string

  @ApiPropertyOptional({
    description: '按文件名搜索（支持模糊匹配）/ Search by filename (fuzzy match supported)',
  })
  @IsOptional()
  @IsString()
  filename?: string

  @ApiPropertyOptional({
    description:
      '按原始文件名搜索（支持模糊匹配）/ Search by original filename (fuzzy match supported)',
  })
  @IsOptional()
  @IsString()
  originalName?: string

  @ApiPropertyOptional({
    description:
      '通用搜索（同时搜索文件名和原始文件名）/ General search (search both filename and original name)',
  })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    description: '开始日期（ISO格式）/ Start date (ISO format)',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string

  @ApiPropertyOptional({
    description: '结束日期（ISO格式）/ End date (ISO format)',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string

  @ApiPropertyOptional({
    description: '最小文件大小（字节）/ Minimum file size (bytes)',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minSize?: number

  @ApiPropertyOptional({
    description: '最大文件大小（字节）/ Maximum file size (bytes)',
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  maxSize?: number

  @ApiPropertyOptional({
    description: '按MIME类型筛选 / Filter by MIME type',
  })
  @IsOptional()
  @IsString()
  mimeType?: string

  @ApiPropertyOptional({
    description: '按文件夹筛选 / Filter by folder',
  })
  @IsOptional()
  @IsString()
  folderId?: string

  @ApiPropertyOptional({
    description: '页码 / Page number',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1

  @ApiPropertyOptional({
    description: '每页数量 / Items per page',
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
    description: '排序字段 / Sort field',
    default: 'date',
  })
  @IsOptional()
  @IsString()
  sortBy?: 'name' | 'size' | 'date' | 'category' = 'date'

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    description: '排序方向 / Sort direction',
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc'

  @ApiPropertyOptional({
    description: '是否验证文件存在性 / Whether to validate file existence',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  validateExistence?: boolean = true

  @ApiPropertyOptional({
    description: '是否自动清理不存在的文件记录 / Whether to auto cleanup missing file records',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  autoCleanup?: boolean = false
}

/**
 * 文件批量操作DTO
 * File Batch Operation DTO
 */
export class FileBatchOperationDto {
  @ApiProperty({
    enum: ['delete', 'move', 'copy', 'changeAccess'],
    description: '批量操作类型 / Batch operation type',
  })
  @IsEnum(['delete', 'move', 'copy', 'changeAccess'])
  action: 'delete' | 'move' | 'copy' | 'changeAccess'

  @ApiProperty({
    type: [String],
    description: '文件ID列表 / File ID list',
  })
  @IsArray()
  @IsString({ each: true })
  fileIds: string[]

  @ApiPropertyOptional({
    enum: FileCategory,
    description:
      '目标分类（移动/复制操作时需要）/ Target category (required for move/copy operations)',
  })
  @IsOptional()
  @IsEnum(FileCategory)
  targetCategory?: FileCategory

  @ApiPropertyOptional({
    enum: FileAccessLevel,
    description:
      '目标访问级别（更改访问权限时需要）/ Target access level (required for access change operations)',
  })
  @IsOptional()
  @IsEnum(FileAccessLevel)
  targetAccessLevel?: FileAccessLevel
}

/**
 * 文件更新DTO
 * File Update DTO
 */
export class FileUpdateDto {
  @ApiPropertyOptional({
    description: '新的文件名（不包含扩展名）/ New filename (without extension)',
  })
  @IsOptional()
  @IsString()
  filename?: string

  @ApiPropertyOptional({
    enum: FileAccessLevel,
    description: '访问级别 / Access level',
  })
  @IsOptional()
  @IsEnum(FileAccessLevel)
  accessLevel?: FileAccessLevel

  @ApiPropertyOptional({
    enum: FileCategory,
    description: '文件分类标记 / File category tag',
  })
  @IsOptional()
  @IsEnum(FileCategory)
  category?: FileCategory

  @ApiPropertyOptional({
    description: '文件元数据（JSON字符串）/ File metadata (JSON string)',
  })
  @IsOptional()
  @IsString()
  metadata?: string
}

/**
 * 文件响应DTO
 * File Response DTO
 */
export class FileResponseDto {
  @ApiProperty({ description: '文件ID / File ID' })
  id: string

  @ApiProperty({ description: '原始文件名 / Original filename' })
  originalName: string

  @ApiProperty({ description: '存储文件名 / Storage filename' })
  filename: string

  @ApiProperty({ description: '文件路径 / File path' })
  path: string

  @ApiProperty({ description: '访问URL / Access URL' })
  url: string

  @ApiProperty({ enum: FileCategory, description: '文件分类 / File category' })
  category: FileCategory

  @ApiProperty({ enum: FileAccessLevel, description: '访问级别 / Access level' })
  accessLevel: FileAccessLevel

  @ApiProperty({ description: '文件大小（字节）/ File size (bytes)' })
  size: number

  @ApiProperty({ description: 'MIME类型 / MIME type' })
  mimeType: string

  @ApiPropertyOptional({ description: '上传者 / Uploader' })
  uploadedBy?: string

  @ApiProperty({ description: '上传时间 / Upload time' })
  uploadedAt: Date

  @ApiPropertyOptional({ description: '所属文件夹ID / Folder ID' })
  folderId?: string

  @ApiPropertyOptional({ description: '文件元数据 / File metadata' })
  metadata?: Record<string, any>

  @ApiPropertyOptional({ description: '文件校验和 / File checksum' })
  checksum?: string
}

/**
 * 文件列表响应DTO
 * File List Response DTO
 */
export class FileListResponseDto {
  @ApiProperty({ type: [FileResponseDto], description: '文件列表 / File list' })
  files: FileResponseDto[]

  @ApiProperty({ description: '总数量 / Total count' })
  total: number

  @ApiProperty({ description: '当前页码 / Current page' })
  page: number

  @ApiProperty({ description: '每页数量 / Items per page' })
  limit: number

  @ApiProperty({ description: '总页数 / Total pages' })
  totalPages: number
}

/**
 * 文件统计响应DTO
 * File Statistics Response DTO
 */
export class FileStatsResponseDto {
  @ApiProperty({ description: '文件总数 / Total files' })
  totalFiles: number

  @ApiProperty({ description: '总大小（字节）/ Total size (bytes)' })
  totalSize: number

  @ApiProperty({ description: '各分类文件数量 / File count by category' })
  categoryCounts: Record<FileCategory, number>

  @ApiProperty({ description: '各分类总大小 / Total size by category' })
  categorySizes: Record<FileCategory, number>

  @ApiProperty({ description: '各访问级别文件数量 / File count by access level' })
  accessLevelCounts: Record<FileAccessLevel, number>
}
