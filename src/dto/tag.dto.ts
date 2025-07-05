import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'

/**
 * 创建标签DTO
 * Create Tag DTO
 */
export class CreateTagDto {
  @ApiProperty({ description: '标签名称 / Tag name' })
  @IsString()
  name: string

  @ApiProperty({ description: '标签颜色（十六进制）/ Tag color (hex)' })
  @IsString()
  color: string

  @ApiPropertyOptional({ description: '标签描述 / Tag description' })
  @IsOptional()
  @IsString()
  description?: string
}

/**
 * 更新标签DTO
 * Update Tag DTO
 */
export class UpdateTagDto {
  @ApiPropertyOptional({ description: '标签名称 / Tag name' })
  @IsOptional()
  @IsString()
  name?: string

  @ApiPropertyOptional({ description: '标签颜色（十六进制）/ Tag color (hex)' })
  @IsOptional()
  @IsString()
  color?: string

  @ApiPropertyOptional({ description: '标签描述 / Tag description' })
  @IsOptional()
  @IsString()
  description?: string
}

/**
 * 标签响应DTO
 * Tag Response DTO
 */
export class TagResponseDto {
  @ApiProperty({ description: '标签ID / Tag ID' })
  id: string

  @ApiProperty({ description: '标签名称 / Tag name' })
  name: string

  @ApiProperty({ description: '标签颜色 / Tag color' })
  color: string

  @ApiPropertyOptional({ description: '标签描述 / Tag description' })
  description?: string

  @ApiProperty({ description: '创建时间 / Created time' })
  createdAt: string

  @ApiProperty({ description: '更新时间 / Updated time' })
  updatedAt: string
}
