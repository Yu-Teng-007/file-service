import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  HttpStatus,
  BadRequestException,
  Query,
} from '@nestjs/common'
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger'
import { CompressionService } from './compression.service'
import {
  CompressionOptions,
  ArchiveOptions,
  ExtractionOptions,
} from './interfaces/compression.interface'

export class CompressFileDto {
  method?: 'gzip' | 'deflate'
  level?: number
}

export class CreateArchiveDto {
  format: 'zip' | 'tar' | 'tar.gz' | 'tar.bz2'
  compression?: CompressionOptions
  comment?: string
}

export class ExtractArchiveDto {
  destination: string
  overwrite?: boolean
  preservePaths?: boolean
}

@ApiTags('compression')
@Controller('compression')
export class CompressionController {
  constructor(private readonly compressionService: CompressionService) {}

  @Post('compress')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: '压缩文件', description: '压缩上传的文件' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '文件压缩请求',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '要压缩的文件',
        },
        method: {
          type: 'string',
          enum: ['gzip', 'deflate'],
          description: '压缩方法',
          default: 'gzip',
        },
        level: {
          type: 'number',
          minimum: 0,
          maximum: 9,
          description: '压缩级别',
          default: 6,
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '文件压缩成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            originalSize: { type: 'number' },
            compressedSize: { type: 'number' },
            compressionRatio: { type: 'number' },
            outputPath: { type: 'string' },
            format: { type: 'string' },
            method: { type: 'string' },
          },
        },
      },
    },
  })
  async compressFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() compressDto: CompressFileDto
  ) {
    if (!file) {
      throw new BadRequestException('请上传要压缩的文件')
    }

    const options: CompressionOptions = {
      method: compressDto.method || 'gzip',
      level: compressDto.level || 6,
    }

    const outputPath = `${file.path}.${options.method}`
    const result = await this.compressionService.compressFile(
      file.path,
      outputPath,
      options
    )

    return {
      success: true,
      message: '文件压缩成功',
      data: result,
    }
  }

  @Post('decompress')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: '解压缩文件', description: '解压缩上传的压缩文件' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '文件解压缩请求',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '要解压缩的文件',
        },
        method: {
          type: 'string',
          enum: ['gzip', 'deflate'],
          description: '解压缩方法',
          default: 'gzip',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '文件解压缩成功',
  })
  async decompressFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('method') method: 'gzip' | 'deflate' = 'gzip'
  ) {
    if (!file) {
      throw new BadRequestException('请上传要解压缩的文件')
    }

    const outputPath = file.path.replace(/\.(gz|deflate)$/, '.decompressed')
    const result = await this.compressionService.decompressFile(
      file.path,
      outputPath,
      method
    )

    return {
      success: true,
      message: '文件解压缩成功',
      data: result,
    }
  }

  @Post('archive')
  @UseInterceptors(FilesInterceptor('files'))
  @ApiOperation({ summary: '创建归档', description: '将多个文件打包成归档文件' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '创建归档请求',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: '要归档的文件',
        },
        format: {
          type: 'string',
          enum: ['zip', 'tar', 'tar.gz', 'tar.bz2'],
          description: '归档格式',
          default: 'zip',
        },
        comment: {
          type: 'string',
          description: '归档注释',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '归档创建成功',
  })
  async createArchive(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() archiveDto: CreateArchiveDto
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('请上传要归档的文件')
    }

    const filePaths = files.map(file => file.path)
    const outputPath = `${files[0].path}.${archiveDto.format}`

    const options: ArchiveOptions = {
      format: archiveDto.format || 'zip',
      compression: archiveDto.compression,
      comment: archiveDto.comment,
    }

    const result = await this.compressionService.createArchive(
      filePaths,
      outputPath,
      options
    )

    return {
      success: true,
      message: '归档创建成功',
      data: result,
    }
  }

  @Post('extract')
  @UseInterceptors(FileInterceptor('archive'))
  @ApiOperation({ summary: '提取归档', description: '提取归档文件中的内容' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: '提取归档请求',
    schema: {
      type: 'object',
      properties: {
        archive: {
          type: 'string',
          format: 'binary',
          description: '要提取的归档文件',
        },
        destination: {
          type: 'string',
          description: '提取目标目录',
        },
        overwrite: {
          type: 'boolean',
          description: '是否覆盖已存在的文件',
          default: false,
        },
        preservePaths: {
          type: 'boolean',
          description: '是否保留路径结构',
          default: true,
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '归档提取成功',
  })
  async extractArchive(
    @UploadedFile() archive: Express.Multer.File,
    @Body() extractDto: ExtractArchiveDto
  ) {
    if (!archive) {
      throw new BadRequestException('请上传要提取的归档文件')
    }

    if (!extractDto.destination) {
      throw new BadRequestException('请指定提取目标目录')
    }

    const options: ExtractionOptions = {
      destination: extractDto.destination,
      overwrite: extractDto.overwrite || false,
      preservePaths: extractDto.preservePaths !== false,
    }

    const result = await this.compressionService.extractArchive(
      archive.path,
      options
    )

    return {
      success: true,
      message: '归档提取成功',
      data: result,
    }
  }

  @Get('info/:path')
  @ApiOperation({ summary: '获取归档信息', description: '获取归档文件的详细信息' })
  @ApiParam({ name: 'path', description: '归档文件路径' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取归档信息成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            format: { type: 'string' },
            totalFiles: { type: 'number' },
            totalSize: { type: 'number' },
            compressedSize: { type: 'number' },
            compressionRatio: { type: 'number' },
            hasPassword: { type: 'boolean' },
            comment: { type: 'string' },
            entries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  path: { type: 'string' },
                  isDirectory: { type: 'boolean' },
                  size: { type: 'number' },
                  date: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  })
  async getArchiveInfo(@Param('path') archivePath: string) {
    const info = await this.compressionService.getArchiveInfo(archivePath)

    return {
      success: true,
      message: '获取归档信息成功',
      data: info,
    }
  }

  @Get('formats')
  @ApiOperation({ summary: '获取支持的格式', description: '获取支持的压缩和归档格式列表' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取格式列表成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            compression: {
              type: 'array',
              items: { type: 'string' },
            },
            archive: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
  })
  getSupportedFormats() {
    return {
      success: true,
      message: '获取格式列表成功',
      data: {
        compression: ['gzip', 'deflate'],
        archive: ['zip', 'tar', 'tar.gz', 'tar.bz2'],
      },
    }
  }
}
