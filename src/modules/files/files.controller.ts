import {
  Controller,
  Post,
  Get,
  Delete,
  Put,
  Param,
  Query,
  Body,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  HttpStatus,
  ParseUUIDPipe,
  Res,
  Header,
  StreamableFile,
  BadRequestException,
} from '@nestjs/common'
import { Response } from 'express'
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express'
import { Cacheable, CacheEvict } from '../cache/decorators/cache.decorator'
import { CacheInterceptor } from '../cache/interceptors/cache.interceptor'
import { CacheEvictInterceptor } from '../cache/interceptors/cache-evict.interceptor'
import { ApiKeyAuth } from '../auth/decorators/api-key-auth.decorator'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger'

import { FilesService } from './files.service'
import {
  FileUploadDto,
  FileSearchDto,
  FileBatchOperationDto,
  FileUpdateDto,
  FileResponseDto,
  FileListResponseDto,
  FileStatsResponseDto,
  ApiResponseDto,
} from '../../types/dto'

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @ApiKeyAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: '上传单个文件', description: '上传单个文件到服务器' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '文件上传',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '要上传的文件',
        },
        category: {
          type: 'string',
          enum: [
            'images',
            'scripts',
            'styles',
            'fonts',
            'documents',
            'music',
            'videos',
            'archives',
          ],
          description: '文件分类（可选，自动检测）',
        },
        accessLevel: {
          type: 'string',
          enum: ['public', 'private', 'protected'],
          description: '访问级别',
          default: 'public',
        },
        customPath: {
          type: 'string',
          description: '自定义存储路径（可选）',
        },
        overwrite: {
          type: 'boolean',
          description: '是否覆盖同名文件',
          default: false,
        },
        metadata: {
          type: 'string',
          description: '文件元数据（JSON字符串）',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '文件上传成功',
    type: ApiResponseDto<FileResponseDto>,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '请求参数错误' })
  @ApiResponse({ status: HttpStatus.PAYLOAD_TOO_LARGE, description: '文件大小超出限制' })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: FileUploadDto
  ): Promise<ApiResponseDto<FileResponseDto>> {
    const result = await this.filesService.uploadFile(file, uploadDto)
    return {
      success: true,
      message: '文件上传成功',
      data: result,
    }
  }

  @Post('upload/multiple')
  @ApiKeyAuth()
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiOperation({ summary: '上传多个文件', description: '批量上传多个文件到服务器' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '多文件上传',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: '要上传的文件列表',
        },
        category: {
          type: 'string',
          enum: [
            'images',
            'scripts',
            'styles',
            'fonts',
            'documents',
            'music',
            'videos',
            'archives',
          ],
          description: '文件分类（可选，自动检测）',
        },
        accessLevel: {
          type: 'string',
          enum: ['public', 'private', 'protected'],
          description: '访问级别',
          default: 'public',
        },
        overwrite: {
          type: 'boolean',
          description: '是否覆盖同名文件',
          default: false,
        },
      },
      required: ['files'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '文件上传成功',
    type: ApiResponseDto<FileResponseDto[]>,
  })
  async uploadMultipleFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() uploadDto: FileUploadDto
  ): Promise<ApiResponseDto<FileResponseDto[]>> {
    const results = await this.filesService.uploadMultipleFiles(files, uploadDto)
    return {
      success: true,
      message: `成功上传 ${results.length} 个文件`,
      data: results,
    }
  }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @Cacheable('files:list:${category}:${page}:${limit}', 300, ['file-list'])
  @ApiOperation({ summary: '获取文件列表', description: '根据条件搜索和筛选文件列表' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取文件列表成功',
    type: ApiResponseDto<FileListResponseDto>,
  })
  async getFiles(@Query() searchDto: FileSearchDto): Promise<ApiResponseDto<FileListResponseDto>> {
    const result = await this.filesService.getFiles(searchDto)
    return {
      success: true,
      message: '获取文件列表成功',
      data: result,
    }
  }

  @Get('stats')
  @ApiOperation({ summary: '获取文件统计信息', description: '获取文件存储的统计数据' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取统计信息成功',
    type: ApiResponseDto<FileStatsResponseDto>,
  })
  async getFileStats(): Promise<ApiResponseDto<FileStatsResponseDto>> {
    const stats = await this.filesService.getFileStats()
    return {
      success: true,
      message: '获取统计信息成功',
      data: stats,
    }
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @Cacheable('file:${id}', 1800, ['file-metadata'])
  @ApiOperation({ summary: '获取文件详情', description: '根据文件ID获取文件详细信息' })
  @ApiParam({ name: 'id', description: '文件ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取文件详情成功',
    type: ApiResponseDto<FileResponseDto>,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '文件不存在' })
  async getFileById(
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<ApiResponseDto<FileResponseDto>> {
    const file = await this.filesService.getFileById(id)
    return {
      success: true,
      message: '获取文件详情成功',
      data: file,
    }
  }

  @Put(':id')
  @ApiOperation({ summary: '更新文件信息', description: '更新文件的元数据信息' })
  @ApiParam({ name: 'id', description: '文件ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '更新文件信息成功',
    type: ApiResponseDto<FileResponseDto>,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '文件不存在' })
  async updateFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: FileUpdateDto
  ): Promise<ApiResponseDto<FileResponseDto>> {
    const file = await this.filesService.updateFile(id, updateDto)
    return {
      success: true,
      message: '更新文件信息成功',
      data: file,
    }
  }

  @Delete(':id')
  @ApiKeyAuth()
  @UseInterceptors(CacheEvictInterceptor)
  @CacheEvict(['file:${id}', 'tag:file-metadata', 'tag:file-list'])
  @ApiOperation({ summary: '删除文件', description: '根据文件ID删除文件' })
  @ApiParam({ name: 'id', description: '文件ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '删除文件成功',
    type: ApiResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '文件不存在' })
  async deleteFile(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto> {
    await this.filesService.deleteFile(id)
    return {
      success: true,
      message: '删除文件成功',
    }
  }

  @Post('batch')
  @ApiKeyAuth()
  @ApiOperation({ summary: '批量操作文件', description: '对多个文件执行批量操作' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '批量操作成功',
    type: ApiResponseDto,
  })
  async batchOperation(@Body() batchDto: FileBatchOperationDto): Promise<ApiResponseDto> {
    const result = await this.filesService.batchOperation(batchDto)
    return {
      success: true,
      message: `批量${batchDto.action}操作完成`,
      data: result,
    }
  }

  @Get(':id/download')
  @ApiOperation({ summary: '下载文件', description: '根据文件ID下载文件' })
  @ApiParam({ name: 'id', description: '文件ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '文件下载成功',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '文件不存在' })
  async downloadFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    const { stream, fileInfo } = await this.filesService.getFileStream(id)

    // 设置响应头
    res.set({
      'Content-Type': fileInfo.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileInfo.originalName)}"`,
      'Content-Length': fileInfo.size.toString(),
    })

    return stream
  }

  @Get(':id/preview')
  @ApiOperation({ summary: '预览文件', description: '根据文件ID预览文件' })
  @ApiParam({ name: 'id', description: '文件ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '文件预览成功',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '文件不存在' })
  async previewFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    const { stream, fileInfo } = await this.filesService.getFilePreview(id)

    // 设置响应头
    res.set({
      'Content-Type': fileInfo.mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(fileInfo.originalName)}"`,
      'Content-Length': fileInfo.size.toString(),
      'Cache-Control': 'public, max-age=3600', // 缓存1小时
    })

    return stream
  }

  @Get(':id/content')
  @UseInterceptors(CacheInterceptor)
  @Cacheable('file-content:${id}:${mode}:${encoding}:${start}:${end}', 300, ['file-content'])
  @ApiOperation({ summary: '读取文件内容', description: '根据文件ID读取文件内容到内存' })
  @ApiParam({ name: 'id', description: '文件ID' })
  @ApiQuery({ name: 'mode', description: '读取模式', enum: ['full', 'partial'], required: false })
  @ApiQuery({ name: 'encoding', description: '文本编码', required: false })
  @ApiQuery({ name: 'start', description: '起始位置（字节）', type: Number, required: false })
  @ApiQuery({ name: 'end', description: '结束位置（字节）', type: Number, required: false })
  @ApiQuery({ name: 'maxSize', description: '最大读取大小（字节）', type: Number, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '文件内容读取成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            content: { type: 'string', description: '文件内容（文本）或base64编码（二进制）' },
            size: { type: 'number', description: '内容大小（字节）' },
            mimeType: { type: 'string', description: 'MIME类型' },
            encoding: { type: 'string', description: '文本编码' },
            fromCache: { type: 'boolean', description: '是否来自缓存' },
            readTime: { type: 'number', description: '读取耗时（毫秒）' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '文件不存在' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '参数错误' })
  async getFileContent(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('mode') mode?: 'full' | 'partial',
    @Query('encoding') encoding?: string,
    @Query('start') start?: number,
    @Query('end') end?: number,
    @Query('maxSize') maxSize?: number
  ) {
    // 验证参数
    if (mode === 'partial' && (start === undefined || start < 0)) {
      throw new BadRequestException('部分读取模式需要指定有效的起始位置')
    }

    if (end !== undefined && start !== undefined && end <= start) {
      throw new BadRequestException('结束位置必须大于起始位置')
    }

    const options = {
      mode: mode as any,
      encoding: encoding === 'buffer' ? ('buffer' as const) : (encoding as BufferEncoding),
      start,
      end,
      maxSize,
    }

    const result = await this.filesService.readFileContent(id, options)

    // 如果是二进制内容，转换为base64
    let content = result.content
    if (Buffer.isBuffer(content)) {
      content = content.toString('base64')
    }

    return {
      success: true,
      message: '文件内容读取成功',
      data: {
        ...result,
        content,
      },
    }
  }

  @Get(':id/text')
  @UseInterceptors(CacheInterceptor)
  @Cacheable('file-text:${id}:${encoding}', 600, ['file-content'])
  @ApiOperation({ summary: '读取文本文件内容', description: '读取文本文件内容并返回字符串' })
  @ApiParam({ name: 'id', description: '文件ID' })
  @ApiQuery({ name: 'encoding', description: '文本编码', required: false, example: 'utf8' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '文本内容读取成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: { type: 'string', description: '文本内容' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '文件不存在' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '文件不是文本格式' })
  async getTextFileContent(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('encoding') encoding: BufferEncoding = 'utf8'
  ) {
    const content = await this.filesService.readTextFile(id, encoding)

    return {
      success: true,
      message: '文本内容读取成功',
      data: content,
    }
  }

  @Get(':id/json')
  @UseInterceptors(CacheInterceptor)
  @Cacheable('file-json:${id}', 600, ['file-content'])
  @ApiOperation({ summary: '读取JSON文件内容', description: '读取JSON文件内容并解析为对象' })
  @ApiParam({ name: 'id', description: '文件ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'JSON内容读取成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: { type: 'object', description: 'JSON对象' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '文件不存在' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'JSON解析失败' })
  async getJsonFileContent(@Param('id', ParseUUIDPipe) id: string) {
    const content = await this.filesService.readJsonFile(id)

    return {
      success: true,
      message: 'JSON内容读取成功',
      data: content,
    }
  }

  @Get('stats/read')
  @ApiOperation({ summary: '获取文件读取统计', description: '获取文件读取操作的统计信息' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '统计信息获取成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            totalReads: { type: 'number', description: '总读取次数' },
            cacheHits: { type: 'number', description: '缓存命中次数' },
            cacheMisses: { type: 'number', description: '缓存未命中次数' },
            averageReadTime: { type: 'number', description: '平均读取时间（毫秒）' },
            totalBytesRead: { type: 'number', description: '总读取字节数' },
          },
        },
      },
    },
  })
  async getFileReadStats() {
    const stats = this.filesService.getFileReadStats()

    return {
      success: true,
      message: '统计信息获取成功',
      data: stats,
    }
  }

  @Delete('cache/content')
  @CacheEvict(['file-content', 'file-text', 'file-json'])
  @ApiOperation({ summary: '清空文件内容缓存', description: '清空所有文件内容缓存' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '缓存清空成功',
  })
  async clearFileContentCache() {
    this.filesService.clearFileContentCache()

    return {
      success: true,
      message: '文件内容缓存已清空',
    }
  }

  @Get(':id/thumbnail')
  @ApiOperation({ summary: '获取文件缩略图', description: '根据文件ID获取缩略图' })
  @ApiParam({ name: 'id', description: '文件ID' })
  @ApiQuery({
    name: 'size',
    description: '缩略图尺寸',
    enum: ['small', 'medium', 'large'],
    required: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '缩略图获取成功',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '文件不存在' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '文件类型不支持缩略图' })
  async getThumbnail(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('size') size: 'small' | 'medium' | 'large' = 'medium',
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    const { stream, fileInfo } = await this.filesService.getFileThumbnail(id, size)

    // 设置响应头
    res.set({
      'Content-Type': fileInfo.mimeType,
      'Content-Disposition': `inline; filename="thumb_${size}_${encodeURIComponent(fileInfo.originalName)}"`,
      'Cache-Control': 'public, max-age=86400', // 缓存24小时
    })

    return stream
  }
}
