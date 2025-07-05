import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'

/**
 * 创建文件夹DTO
 * Create Folder DTO
 */
export class CreateFolderDto {
  @ApiProperty({ description: '文件夹名称 / Folder name' })
  @IsString()
  name: string

  @ApiPropertyOptional({ description: '父文件夹ID / Parent folder ID' })
  @IsOptional()
  @IsString()
  parentId?: string

  @ApiPropertyOptional({ description: '自定义路径 / Custom path' })
  @IsOptional()
  @IsString()
  path?: string
}

/**
 * 更新文件夹DTO
 * Update Folder DTO
 */
export class UpdateFolderDto {
  @ApiPropertyOptional({ description: '文件夹名称 / Folder name' })
  @IsOptional()
  @IsString()
  name?: string
}

/**
 * 文件夹响应DTO
 * Folder Response DTO
 */
export class FolderResponseDto {
  @ApiProperty({ description: '文件夹ID / Folder ID' })
  id: string

  @ApiProperty({ description: '文件夹名称 / Folder name' })
  name: string

  @ApiProperty({ description: '文件夹路径 / Folder path' })
  path: string

  @ApiPropertyOptional({ description: '父文件夹ID / Parent folder ID' })
  parentId?: string

  @ApiProperty({ description: '文件数量 / File count' })
  fileCount: number

  @ApiProperty({ description: '总大小（字节）/ Total size (bytes)' })
  totalSize: number

  @ApiProperty({ description: '创建时间 / Created time' })
  createdAt: string

  @ApiProperty({ description: '更新时间 / Updated time' })
  updatedAt: string

  @ApiPropertyOptional({ description: '是否为系统文件夹 / Is system folder' })
  isSystem?: boolean
}
