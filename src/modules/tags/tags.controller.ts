import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger'
import { TagsService } from './tags.service'
import { ApiKeyAuth } from '../auth/decorators/api-key-auth.decorator'
import { CreateTagDto, UpdateTagDto, TagResponseDto, ApiResponseDto } from '../../dto'

@ApiTags('tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @ApiOperation({ summary: '获取所有标签', description: '获取系统中所有可用的文件标签' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取标签列表成功',
    type: ApiResponseDto<TagResponseDto[]>,
  })
  async getAllTags(): Promise<ApiResponseDto<TagResponseDto[]>> {
    const tags = await this.tagsService.getAllTags()
    return {
      success: true,
      message: '获取标签列表成功',
      data: tags,
    }
  }

  @Get(':id')
  @ApiOperation({ summary: '获取标签详情', description: '根据ID获取标签详细信息' })
  @ApiParam({ name: 'id', description: '标签ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取标签详情成功',
    type: ApiResponseDto<TagResponseDto>,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '标签不存在' })
  async getTagById(
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<ApiResponseDto<TagResponseDto>> {
    const tag = await this.tagsService.getTagById(id)
    return {
      success: true,
      message: '获取标签详情成功',
      data: tag,
    }
  }

  @Post()
  @ApiKeyAuth()
  @ApiOperation({ summary: '创建标签', description: '创建新的文件标签' })
  @ApiBody({ type: CreateTagDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '标签创建成功',
    type: ApiResponseDto<TagResponseDto>,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '参数错误' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: '标签已存在' })
  async createTag(@Body() createTagDto: CreateTagDto): Promise<ApiResponseDto<TagResponseDto>> {
    const tag = await this.tagsService.createTag(createTagDto)
    return {
      success: true,
      message: '标签创建成功',
      data: tag,
    }
  }

  @Put(':id')
  @ApiKeyAuth()
  @ApiOperation({ summary: '更新标签', description: '更新标签信息' })
  @ApiParam({ name: 'id', description: '标签ID' })
  @ApiBody({ type: UpdateTagDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '标签更新成功',
    type: ApiResponseDto<TagResponseDto>,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '标签不存在' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '参数错误' })
  async updateTag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTagDto: UpdateTagDto
  ): Promise<ApiResponseDto<TagResponseDto>> {
    const tag = await this.tagsService.updateTag(id, updateTagDto)
    return {
      success: true,
      message: '标签更新成功',
      data: tag,
    }
  }

  @Delete(':id')
  @ApiKeyAuth()
  @ApiOperation({ summary: '删除标签', description: '删除标签（会同时移除所有文件的此标签关联）' })
  @ApiParam({ name: 'id', description: '标签ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '标签删除成功',
    type: ApiResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '标签不存在' })
  async deleteTag(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto> {
    await this.tagsService.deleteTag(id)
    return {
      success: true,
      message: '标签删除成功',
    }
  }

  @Get(':id/files')
  @ApiOperation({ summary: '获取标签关联的文件', description: '获取使用指定标签的所有文件' })
  @ApiParam({ name: 'id', description: '标签ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取文件列表成功',
  })
  async getTagFiles(@Param('id', ParseUUIDPipe) id: string) {
    const files = await this.tagsService.getTagFiles(id)
    return {
      success: true,
      message: '获取文件列表成功',
      data: files,
    }
  }
}

@ApiTags('files')
@Controller('files')
export class FileTagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post(':fileId/tags')
  @ApiKeyAuth()
  @ApiOperation({ summary: '为文件添加标签', description: '为指定文件添加一个或多个标签' })
  @ApiParam({ name: 'fileId', description: '文件ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        tagIds: {
          type: 'array',
          items: { type: 'string' },
          description: '要添加的标签ID列表',
        },
      },
      required: ['tagIds'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '标签添加成功',
    type: ApiResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '参数错误' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '文件或标签不存在' })
  async addTagsToFile(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Body('tagIds') tagIds: string[]
  ): Promise<ApiResponseDto> {
    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      throw new BadRequestException('标签ID列表不能为空')
    }

    await this.tagsService.addTagsToFile(fileId, tagIds)
    return {
      success: true,
      message: `成功为文件添加 ${tagIds.length} 个标签`,
    }
  }

  @Delete(':fileId/tags')
  @ApiKeyAuth()
  @ApiOperation({ summary: '从文件移除标签', description: '从指定文件移除一个或多个标签' })
  @ApiParam({ name: 'fileId', description: '文件ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        tagIds: {
          type: 'array',
          items: { type: 'string' },
          description: '要移除的标签ID列表',
        },
      },
      required: ['tagIds'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '标签移除成功',
    type: ApiResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '参数错误' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '文件不存在' })
  async removeTagsFromFile(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Body('tagIds') tagIds: string[]
  ): Promise<ApiResponseDto> {
    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      throw new BadRequestException('标签ID列表不能为空')
    }

    await this.tagsService.removeTagsFromFile(fileId, tagIds)
    return {
      success: true,
      message: `成功从文件移除 ${tagIds.length} 个标签`,
    }
  }

  @Get(':fileId/tags')
  @ApiOperation({ summary: '获取文件的标签', description: '获取指定文件的所有标签' })
  @ApiParam({ name: 'fileId', description: '文件ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取文件标签成功',
    type: ApiResponseDto<TagResponseDto[]>,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '文件不存在' })
  async getFileTags(
    @Param('fileId', ParseUUIDPipe) fileId: string
  ): Promise<ApiResponseDto<TagResponseDto[]>> {
    const tags = await this.tagsService.getFileTags(fileId)
    return {
      success: true,
      message: '获取文件标签成功',
      data: tags,
    }
  }
}
