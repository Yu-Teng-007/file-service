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
