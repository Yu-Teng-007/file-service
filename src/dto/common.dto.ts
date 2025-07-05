import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * 通用API响应DTO
 * Generic API Response DTO
 */
export class ApiResponseDto<T = any> {
  @ApiProperty({ description: '操作是否成功 / Operation success status' })
  success: boolean

  @ApiProperty({ description: '响应消息 / Response message' })
  message: string

  @ApiPropertyOptional({ description: '响应数据 / Response data' })
  data?: T

  @ApiPropertyOptional({ description: '错误信息 / Error information' })
  error?: string
}

/**
 * 分页响应基础类
 * Base pagination response class
 */
export class PaginatedResponseDto<T> {
  @ApiProperty({ description: '数据列表 / Data list' })
  items: T[]

  @ApiProperty({ description: '总数量 / Total count' })
  total: number

  @ApiProperty({ description: '当前页码 / Current page' })
  page: number

  @ApiProperty({ description: '每页数量 / Items per page' })
  limit: number

  @ApiProperty({ description: '总页数 / Total pages' })
  totalPages: number
}
