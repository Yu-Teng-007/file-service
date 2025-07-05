import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * 回收站项目响应DTO
 * Trash Item Response DTO
 */
export class TrashItemResponseDto {
  @ApiProperty({ description: '回收站项目ID / Trash item ID' })
  id: string

  @ApiProperty({ description: '原始文件信息 / Original file information' })
  originalFileInfo: any

  @ApiProperty({ description: '删除时间 / Deleted time' })
  deletedAt: string

  @ApiPropertyOptional({ description: '删除者 / Deleted by' })
  deletedBy?: string

  @ApiProperty({ description: '原始路径 / Original path' })
  originalPath: string
}

/**
 * 回收站统计响应DTO
 * Trash Statistics Response DTO
 */
export interface TrashStatsResponseDto {
  /** 文件总数 / Total files */
  totalFiles: number
  
  /** 总大小（字节）/ Total size (bytes) */
  totalSize: number
  
  /** 最旧文件删除时间 / Oldest file deletion time */
  oldestFile?: string
  
  /** 最新文件删除时间 / Newest file deletion time */
  newestFile?: string
}
