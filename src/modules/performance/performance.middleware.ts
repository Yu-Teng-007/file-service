import { Injectable, NestMiddleware, Logger } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { PerformanceService } from './performance.service'

@Injectable()
export class PerformanceMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PerformanceMiddleware.name)

  constructor(private readonly performanceService: PerformanceService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now()
    const startHrTime = process.hrtime()

    // 记录请求开始
    this.logger.debug(`请求开始: ${req.method} ${req.path}`)

    // 监听响应完成事件
    res.on('finish', () => {
      const endTime = Date.now()
      const responseTime = endTime - startTime
      const success = res.statusCode < 400

      // 记录请求指标
      this.performanceService.recordRequest(responseTime, success)

      // 如果是文件操作，记录额外指标
      if (this.isFileOperation(req)) {
        this.recordFileOperationMetrics(req, res, responseTime)
      }

      // 记录错误（如果有）
      if (!success) {
        const errorType = this.getErrorType(res.statusCode)
        this.performanceService.recordError(errorType, `HTTP ${res.statusCode}`)
      }

      // 详细日志
      this.logger.debug(
        `请求完成: ${req.method} ${req.path} - ${res.statusCode} (${responseTime}ms)`
      )
    })

    // 监听响应错误事件
    res.on('error', (error) => {
      const responseTime = Date.now() - startTime
      
      // 记录错误请求
      this.performanceService.recordRequest(responseTime, false)
      this.performanceService.recordError('response_error', error.message)

      this.logger.error(
        `响应错误: ${req.method} ${req.path}`,
        error.stack
      )
    })

    next()
  }

  /**
   * 判断是否为文件操作
   */
  private isFileOperation(req: Request): boolean {
    const fileOperationPaths = [
      '/api/files/upload',
      '/api/files/download',
      '/uploads/',
    ]

    return fileOperationPaths.some(path => req.path.includes(path))
  }

  /**
   * 记录文件操作指标
   */
  private recordFileOperationMetrics(req: Request, res: Response, responseTime: number): void {
    try {
      let operation: 'upload' | 'download' | null = null
      let fileSize = 0

      // 判断操作类型
      if (req.path.includes('/upload') && req.method === 'POST') {
        operation = 'upload'
        // 从请求中获取文件大小
        if (req.file) {
          fileSize = req.file.size
        } else if (req.files && Array.isArray(req.files)) {
          fileSize = req.files.reduce((total, file) => total + file.size, 0)
        }
      } else if (req.path.includes('/download') || req.method === 'GET') {
        operation = 'download'
        // 从响应头获取文件大小
        const contentLength = res.getHeader('content-length')
        if (contentLength) {
          fileSize = parseInt(contentLength.toString(), 10)
        }
      }

      if (operation && fileSize > 0) {
        this.performanceService.recordFileOperation(operation, fileSize, responseTime)
      }
    } catch (error) {
      this.logger.warn('记录文件操作指标失败', error)
    }
  }

  /**
   * 根据状态码获取错误类型
   */
  private getErrorType(statusCode: number): string {
    if (statusCode >= 500) {
      return 'server_error'
    } else if (statusCode >= 400) {
      return 'client_error'
    }
    return 'unknown_error'
  }
}
