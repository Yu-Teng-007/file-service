import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { promises as fs, createReadStream, createWriteStream } from 'fs'
import { join, dirname, basename, extname } from 'path'
import { pipeline } from 'stream/promises'
import { createGzip, createDeflate, createGunzip, createInflate } from 'zlib'
import * as archiver from 'archiver'
import * as unzipper from 'unzipper'
import * as tar from 'tar-fs'
import {
  CompressionOptions,
  ArchiveOptions,
  ArchiveEntry,
  ExtractionOptions,
  CompressionResult,
  ArchiveResult,
  ExtractionResult,
  ArchiveInfo,
  ProgressCallback,
} from './interfaces/compression.interface'

@Injectable()
export class CompressionService {
  private readonly logger = new Logger(CompressionService.name)

  constructor(private configService: ConfigService) {}

  /**
   * 压缩单个文件
   */
  async compressFile(
    inputPath: string,
    outputPath: string,
    options: CompressionOptions = {}
  ): Promise<CompressionResult> {
    try {
      this.logger.log(`开始压缩文件: ${inputPath}`)

      const inputStats = await fs.stat(inputPath)
      const originalSize = inputStats.size

      // 确保输出目录存在
      await fs.mkdir(dirname(outputPath), { recursive: true })

      // 创建压缩流
      const compressor = this.createCompressor(options)

      // 执行压缩
      await pipeline(createReadStream(inputPath), compressor, createWriteStream(outputPath))

      const outputStats = await fs.stat(outputPath)
      const compressedSize = outputStats.size
      const compressionRatio = (originalSize - compressedSize) / originalSize

      const result: CompressionResult = {
        originalSize,
        compressedSize,
        compressionRatio,
        outputPath,
        format: this.getCompressionFormat(options.method || 'gzip'),
        method: options.method || 'gzip',
      }

      this.logger.log(`文件压缩完成: ${inputPath} -> ${outputPath}`)
      this.logger.log(`压缩比: ${(compressionRatio * 100).toFixed(2)}%`)

      return result
    } catch (error) {
      this.logger.error(`文件压缩失败: ${inputPath}`, error)
      throw error
    }
  }

  /**
   * 解压缩单个文件
   */
  async decompressFile(
    inputPath: string,
    outputPath: string,
    method: 'gzip' | 'deflate' = 'gzip'
  ): Promise<CompressionResult> {
    try {
      this.logger.log(`开始解压缩文件: ${inputPath}`)

      const inputStats = await fs.stat(inputPath)
      const compressedSize = inputStats.size

      // 确保输出目录存在
      await fs.mkdir(dirname(outputPath), { recursive: true })

      // 创建解压缩流
      const decompressor = this.createDecompressor(method)

      // 执行解压缩
      await pipeline(createReadStream(inputPath), decompressor, createWriteStream(outputPath))

      const outputStats = await fs.stat(outputPath)
      const originalSize = outputStats.size
      const compressionRatio = (originalSize - compressedSize) / originalSize

      const result: CompressionResult = {
        originalSize,
        compressedSize,
        compressionRatio,
        outputPath,
        format: this.getCompressionFormat(method),
        method,
      }

      this.logger.log(`文件解压缩完成: ${inputPath} -> ${outputPath}`)

      return result
    } catch (error) {
      this.logger.error(`文件解压缩失败: ${inputPath}`, error)
      throw error
    }
  }

  /**
   * 创建归档文件
   */
  async createArchive(
    files: string[],
    outputPath: string,
    options: ArchiveOptions,
    progressCallback?: ProgressCallback
  ): Promise<ArchiveResult> {
    try {
      this.logger.log(`开始创建归档: ${outputPath}`)

      // 确保输出目录存在
      await fs.mkdir(dirname(outputPath), { recursive: true })

      const entries: ArchiveEntry[] = []
      let totalSize = 0

      // 收集文件信息
      for (const filePath of files) {
        const stats = await fs.stat(filePath)
        const entry: ArchiveEntry = {
          name: basename(filePath),
          path: filePath,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          date: stats.mtime,
        }
        entries.push(entry)
        totalSize += stats.size
      }

      let compressedSize = 0

      if (options.format === 'zip') {
        compressedSize = await this.createZipArchive(files, outputPath, options, progressCallback)
      } else if (options.format.startsWith('tar')) {
        compressedSize = await this.createTarArchive(files, outputPath, options, progressCallback)
      } else {
        throw new BadRequestException(`不支持的归档格式: ${options.format}`)
      }

      const compressionRatio = totalSize > 0 ? (totalSize - compressedSize) / totalSize : 0

      const result: ArchiveResult = {
        archivePath: outputPath,
        entries,
        totalSize,
        compressedSize,
        compressionRatio,
        format: options.format,
      }

      this.logger.log(`归档创建完成: ${outputPath}`)
      this.logger.log(`压缩比: ${(compressionRatio * 100).toFixed(2)}%`)

      return result
    } catch (error) {
      this.logger.error(`创建归档失败: ${outputPath}`, error)
      throw error
    }
  }

  /**
   * 提取归档文件
   */
  async extractArchive(
    archivePath: string,
    options: ExtractionOptions,
    progressCallback?: ProgressCallback
  ): Promise<ExtractionResult> {
    try {
      this.logger.log(`开始提取归档: ${archivePath}`)

      // 确保目标目录存在
      await fs.mkdir(options.destination, { recursive: true })

      const format = this.detectArchiveFormat(archivePath)
      let result: ExtractionResult

      if (format === 'zip') {
        result = await this.extractZipArchive(archivePath, options, progressCallback)
      } else if (format.startsWith('tar')) {
        result = await this.extractTarArchive(archivePath, options, progressCallback)
      } else {
        throw new BadRequestException(`不支持的归档格式: ${format}`)
      }

      this.logger.log(`归档提取完成: ${archivePath}`)
      this.logger.log(`提取文件数: ${result.totalFiles}`)

      return result
    } catch (error) {
      this.logger.error(`提取归档失败: ${archivePath}`, error)
      throw error
    }
  }

  /**
   * 获取归档信息
   */
  async getArchiveInfo(archivePath: string): Promise<ArchiveInfo> {
    try {
      const format = this.detectArchiveFormat(archivePath)
      const stats = await fs.stat(archivePath)

      if (format === 'zip') {
        return this.getZipInfo(archivePath, stats.size)
      } else if (format.startsWith('tar')) {
        return this.getTarInfo(archivePath, stats.size)
      } else {
        throw new BadRequestException(`不支持的归档格式: ${format}`)
      }
    } catch (error) {
      this.logger.error(`获取归档信息失败: ${archivePath}`, error)
      throw error
    }
  }

  /**
   * 创建压缩器
   */
  private createCompressor(options: CompressionOptions) {
    const level = options.level || 6

    switch (options.method || 'gzip') {
      case 'gzip':
        return createGzip({
          level,
          chunkSize: options.chunkSize,
          windowBits: options.windowBits,
          memLevel: options.memLevel,
          strategy: options.strategy,
        })
      case 'deflate':
        return createDeflate({
          level,
          chunkSize: options.chunkSize,
          windowBits: options.windowBits,
          memLevel: options.memLevel,
          strategy: options.strategy,
        })
      default:
        throw new BadRequestException(`不支持的压缩方法: ${options.method}`)
    }
  }

  /**
   * 创建解压缩器
   */
  private createDecompressor(method: 'gzip' | 'deflate') {
    switch (method) {
      case 'gzip':
        return createGunzip()
      case 'deflate':
        return createInflate()
      default:
        throw new BadRequestException(`不支持的解压缩方法: ${method}`)
    }
  }

  /**
   * 创建ZIP归档
   */
  private async createZipArchive(
    files: string[],
    outputPath: string,
    options: ArchiveOptions,
    progressCallback?: ProgressCallback
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath)
      const archive = archiver('zip', {
        zlib: { level: options.compression?.level || 6 },
        comment: options.comment,
      })

      let processedFiles = 0
      const totalFiles = files.length

      output.on('close', () => {
        resolve(archive.pointer())
      })

      archive.on('error', reject)
      archive.on('entry', () => {
        processedFiles++
        if (progressCallback) {
          progressCallback({
            processed: processedFiles,
            total: totalFiles,
            percentage: (processedFiles / totalFiles) * 100,
          })
        }
      })

      archive.pipe(output)

      // 添加文件到归档
      for (const filePath of files) {
        const name = basename(filePath)
        archive.file(filePath, { name })
      }

      archive.finalize()
    })
  }

  /**
   * 创建TAR归档
   */
  private async createTarArchive(
    files: string[],
    outputPath: string,
    options: ArchiveOptions,
    progressCallback?: ProgressCallback
  ): Promise<number> {
    // TAR归档实现（简化版）
    // 实际项目中需要更完整的实现
    throw new BadRequestException('TAR归档功能暂未实现')
  }

  /**
   * 提取ZIP归档
   */
  private async extractZipArchive(
    archivePath: string,
    options: ExtractionOptions,
    progressCallback?: ProgressCallback
  ): Promise<ExtractionResult> {
    return new Promise((resolve, reject) => {
      const extractedFiles: ArchiveEntry[] = []
      let totalSize = 0
      let processedFiles = 0

      createReadStream(archivePath)
        .pipe(unzipper.Parse())
        .on('entry', entry => {
          const fileName = entry.path
          const type = entry.type
          const size = entry.vars.uncompressedSize

          // 应用过滤器
          if (
            options.filter &&
            !options.filter({
              name: fileName,
              path: fileName,
              isDirectory: type === 'Directory',
              size,
            })
          ) {
            entry.autodrain()
            return
          }

          const outputPath = join(options.destination, fileName)

          if (type === 'Directory') {
            fs.mkdir(outputPath, { recursive: true }).then(() => {
              entry.autodrain()
            })
          } else {
            entry.pipe(createWriteStream(outputPath))
          }

          extractedFiles.push({
            name: fileName,
            path: outputPath,
            isDirectory: type === 'Directory',
            size,
          })

          totalSize += size
          processedFiles++

          if (progressCallback) {
            progressCallback({
              processed: processedFiles,
              total: extractedFiles.length,
              percentage: (processedFiles / extractedFiles.length) * 100,
              currentFile: fileName,
            })
          }
        })
        .on('finish', () => {
          resolve({
            extractedFiles,
            totalFiles: extractedFiles.length,
            totalSize,
            destination: options.destination,
          })
        })
        .on('error', reject)
    })
  }

  /**
   * 提取TAR归档
   */
  private async extractTarArchive(
    archivePath: string,
    options: ExtractionOptions,
    progressCallback?: ProgressCallback
  ): Promise<ExtractionResult> {
    // TAR提取实现（简化版）
    throw new BadRequestException('TAR提取功能暂未实现')
  }

  /**
   * 获取ZIP信息
   */
  private async getZipInfo(archivePath: string, compressedSize: number): Promise<ArchiveInfo> {
    return new Promise((resolve, reject) => {
      const entries: ArchiveEntry[] = []
      let totalSize = 0

      createReadStream(archivePath)
        .pipe(unzipper.Parse())
        .on('entry', entry => {
          const fileName = entry.path
          const type = entry.type
          const size = entry.vars.uncompressedSize

          entries.push({
            name: fileName,
            path: fileName,
            isDirectory: type === 'Directory',
            size,
          })

          totalSize += size
          entry.autodrain()
        })
        .on('finish', () => {
          const compressionRatio = totalSize > 0 ? (totalSize - compressedSize) / totalSize : 0

          resolve({
            format: 'zip',
            entries,
            totalFiles: entries.length,
            totalSize,
            compressedSize,
            compressionRatio,
            hasPassword: false, // 简化实现
          })
        })
        .on('error', reject)
    })
  }

  /**
   * 获取TAR信息
   */
  private async getTarInfo(archivePath: string, compressedSize: number): Promise<ArchiveInfo> {
    // TAR信息获取实现（简化版）
    throw new BadRequestException('TAR信息获取功能暂未实现')
  }

  /**
   * 检测归档格式
   */
  private detectArchiveFormat(archivePath: string): string {
    const ext = extname(archivePath).toLowerCase()

    switch (ext) {
      case '.zip':
        return 'zip'
      case '.tar':
        return 'tar'
      case '.gz':
        if (archivePath.endsWith('.tar.gz')) {
          return 'tar.gz'
        }
        return 'gzip'
      case '.bz2':
        if (archivePath.endsWith('.tar.bz2')) {
          return 'tar.bz2'
        }
        return 'bzip2'
      default:
        throw new BadRequestException(`无法识别的归档格式: ${ext}`)
    }
  }

  /**
   * 获取压缩格式名称
   */
  private getCompressionFormat(method: string): string {
    switch (method) {
      case 'gzip':
        return 'gzip'
      case 'deflate':
        return 'deflate'
      case 'brotli':
        return 'brotli'
      default:
        return method
    }
  }
}
