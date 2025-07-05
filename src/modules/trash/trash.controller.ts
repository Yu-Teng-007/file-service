import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger'
import { TrashService } from './trash.service'
import { ApiKeyAuth } from '../auth/decorators/api-key-auth.decorator'
import { TrashItemResponseDto, ApiResponseDto, TrashStatsResponseDto } from '../../dto'

@ApiTags('trash')
@Controller('files/trash')
export class TrashController {
  constructor(private readonly trashService: TrashService) {}

  @Get()
  @ApiOperation({ summary: '获取回收站文件列表', description: '获取所有已删除的文件列表' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取回收站文件列表成功',
    type: ApiResponseDto<TrashItemResponseDto[]>,
  })
  async getTrashFiles(): Promise<ApiResponseDto<TrashItemResponseDto[]>> {
    const trashItems = await this.trashService.getTrashFiles()
    return {
      success: true,
      message: '获取回收站文件列表成功',
      data: trashItems,
    }
  }

  @Post('restore')
  @ApiKeyAuth()
  @ApiOperation({ summary: '从回收站恢复文件', description: '将文件从回收站恢复到原始位置' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fileIds: {
          type: 'array',
          items: { type: 'string' },
          description: '要恢复的文件ID列表',
        },
      },
      required: ['fileIds'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '文件恢复成功',
    type: ApiResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '参数错误' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '文件不存在' })
  async restoreFiles(@Body('fileIds') fileIds: string[]): Promise<ApiResponseDto> {
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      throw new BadRequestException('文件ID列表不能为空')
    }

    const restoredCount = await this.trashService.restoreFiles(fileIds)
    return {
      success: true,
      message: `成功恢复 ${restoredCount} 个文件`,
    }
  }

  @Delete('permanent')
  @ApiKeyAuth()
  @ApiOperation({ summary: '永久删除文件', description: '从回收站永久删除文件，此操作不可撤销' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fileIds: {
          type: 'array',
          items: { type: 'string' },
          description: '要永久删除的文件ID列表',
        },
      },
      required: ['fileIds'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '文件永久删除成功',
    type: ApiResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '参数错误' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '文件不存在' })
  async permanentDeleteFiles(@Body('fileIds') fileIds: string[]): Promise<ApiResponseDto> {
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      throw new BadRequestException('文件ID列表不能为空')
    }

    const deletedCount = await this.trashService.permanentDeleteFiles(fileIds)
    return {
      success: true,
      message: `成功永久删除 ${deletedCount} 个文件`,
    }
  }

  @Delete('empty')
  @ApiKeyAuth()
  @ApiOperation({ summary: '清空回收站', description: '清空回收站中的所有文件，此操作不可撤销' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '回收站清空成功',
    type: ApiResponseDto,
  })
  async emptyTrash(): Promise<ApiResponseDto> {
    const deletedCount = await this.trashService.emptyTrash()
    return {
      success: true,
      message: `成功清空回收站，删除了 ${deletedCount} 个文件`,
    }
  }

  @Get('stats')
  @ApiOperation({ summary: '获取回收站统计信息', description: '获取回收站文件数量和占用空间统计' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取回收站统计信息成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            totalFiles: { type: 'number', description: '文件总数' },
            totalSize: { type: 'number', description: '总大小（字节）' },
            oldestFile: { type: 'string', description: '最早删除时间' },
            newestFile: { type: 'string', description: '最近删除时间' },
          },
        },
      },
    },
  })
  async getTrashStats(): Promise<{
    success: boolean
    message: string
    data: TrashStatsResponseDto
  }> {
    const stats = await this.trashService.getTrashStats()
    return {
      success: true,
      message: '获取回收站统计信息成功',
      data: stats,
    }
  }

  @Post('cleanup')
  @ApiKeyAuth()
  @ApiOperation({ summary: '清理过期文件', description: '自动清理回收站中超过指定天数的文件' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: '保留天数，超过此天数的文件将被永久删除',
          default: 30,
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '过期文件清理成功',
    type: ApiResponseDto,
  })
  async cleanupExpiredFiles(@Body('days') days: number = 30): Promise<ApiResponseDto> {
    if (days < 1) {
      throw new BadRequestException('保留天数必须大于0')
    }

    const deletedCount = await this.trashService.cleanupExpiredFiles(days)
    return {
      success: true,
      message: `成功清理 ${deletedCount} 个过期文件`,
    }
  }
}
