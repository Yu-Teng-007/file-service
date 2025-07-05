import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger'
import { FoldersService } from './folders.service'
import { ApiKeyAuth } from '../auth/decorators/api-key-auth.decorator'
import {
  CreateFolderDto,
  UpdateFolderDto,
  FolderResponseDto,
  ApiResponseDto,
} from '../../types/dto'

@ApiTags('folders')
@Controller('folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Get()
  @ApiOperation({
    summary: '获取文件夹列表',
    description: '获取文件夹树形结构或指定父文件夹下的子文件夹',
  })
  @ApiQuery({ name: 'parentId', description: '父文件夹ID', required: false })
  @ApiQuery({
    name: 'includeFiles',
    description: '是否包含文件统计',
    required: false,
    type: Boolean,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取文件夹列表成功',
    type: ApiResponseDto<FolderResponseDto[]>,
  })
  async getFolders(
    @Query('parentId') parentId?: string,
    @Query('includeFiles') includeFiles?: boolean
  ): Promise<ApiResponseDto<FolderResponseDto[]>> {
    const folders = await this.foldersService.getFolders(parentId, includeFiles)
    return {
      success: true,
      message: '获取文件夹列表成功',
      data: folders,
    }
  }

  @Get(':id')
  @ApiOperation({ summary: '获取文件夹详情', description: '根据ID获取文件夹详细信息' })
  @ApiParam({ name: 'id', description: '文件夹ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取文件夹详情成功',
    type: ApiResponseDto<FolderResponseDto>,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '文件夹不存在' })
  async getFolderById(
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<ApiResponseDto<FolderResponseDto>> {
    const folder = await this.foldersService.getFolderById(id)
    return {
      success: true,
      message: '获取文件夹详情成功',
      data: folder,
    }
  }

  @Post()
  @ApiKeyAuth()
  @ApiOperation({ summary: '创建文件夹', description: '创建新的文件夹' })
  @ApiBody({ type: CreateFolderDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '文件夹创建成功',
    type: ApiResponseDto<FolderResponseDto>,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '参数错误' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: '文件夹已存在' })
  async createFolder(
    @Body() createFolderDto: CreateFolderDto
  ): Promise<ApiResponseDto<FolderResponseDto>> {
    const folder = await this.foldersService.createFolder(createFolderDto)
    return {
      success: true,
      message: '文件夹创建成功',
      data: folder,
    }
  }

  @Put(':id')
  @ApiKeyAuth()
  @ApiOperation({ summary: '更新文件夹', description: '更新文件夹信息' })
  @ApiParam({ name: 'id', description: '文件夹ID' })
  @ApiBody({ type: UpdateFolderDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '文件夹更新成功',
    type: ApiResponseDto<FolderResponseDto>,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '文件夹不存在' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '参数错误' })
  async updateFolder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateFolderDto: UpdateFolderDto
  ): Promise<ApiResponseDto<FolderResponseDto>> {
    const folder = await this.foldersService.updateFolder(id, updateFolderDto)
    return {
      success: true,
      message: '文件夹更新成功',
      data: folder,
    }
  }

  @Delete(':id')
  @ApiKeyAuth()
  @ApiOperation({
    summary: '删除文件夹',
    description: '删除指定的文件夹（需要先清空文件夹中的所有文件和子文件夹）',
  })
  @ApiParam({ name: 'id', description: '文件夹ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '文件夹删除成功',
    type: ApiResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '文件夹不存在' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '文件夹不为空，无法删除' })
  async deleteFolder(@Param('id') id: string): Promise<ApiResponseDto> {
    // 检查特殊文件夹ID
    if (id === 'all' || id === 'root') {
      throw new BadRequestException('系统文件夹无法删除')
    }

    // 验证UUID格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      throw new BadRequestException('无效的文件夹ID格式')
    }

    await this.foldersService.deleteFolder(id)
    return {
      success: true,
      message: '文件夹删除成功',
    }
  }

  @Get(':id/files')
  @ApiOperation({ summary: '获取文件夹中的文件', description: '获取指定文件夹中的所有文件' })
  @ApiParam({ name: 'id', description: '文件夹ID' })
  @ApiQuery({ name: 'page', description: '页码', required: false, type: Number })
  @ApiQuery({ name: 'limit', description: '每页数量', required: false, type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取文件列表成功',
  })
  async getFolderFiles(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    const files = await this.foldersService.getFolderFiles(id, page, limit)
    return {
      success: true,
      message: '获取文件列表成功',
      data: files,
    }
  }

  @Post(':id/move')
  @ApiKeyAuth()
  @ApiOperation({ summary: '移动文件到文件夹', description: '将文件移动到指定文件夹' })
  @ApiParam({ name: 'id', description: '目标文件夹ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fileIds: {
          type: 'array',
          items: { type: 'string' },
          description: '要移动的文件ID列表',
        },
      },
      required: ['fileIds'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '文件移动成功',
    type: ApiResponseDto,
  })
  async moveFilesToFolder(
    @Param('id', ParseUUIDPipe) folderId: string,
    @Body('fileIds') fileIds: string[]
  ): Promise<ApiResponseDto> {
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      throw new BadRequestException('文件ID列表不能为空')
    }

    await this.foldersService.moveFilesToFolder(fileIds, folderId)
    return {
      success: true,
      message: `成功移动 ${fileIds.length} 个文件`,
    }
  }
}
