import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Injectable,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Request, Response } from 'express'
import { MonitoringService } from '../../modules/monitoring/monitoring.service'

export interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: any
    timestamp: string
    path: string
    method: string
    requestId?: string
    stack?: string
  }
}

@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly monitoringService: MonitoringService
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const errorResponse = this.buildErrorResponse(exception, request)

    // 记录错误日志
    this.logError(exception, request, errorResponse)

    // 记录错误监控
    this.recordErrorMetrics(exception, request)

    response
      .status(
        errorResponse.error.code === 'INTERNAL_SERVER_ERROR' ? 500 : this.getHttpStatus(exception)
      )
      .json(errorResponse)
  }

  private buildErrorResponse(exception: unknown, request: Request): ErrorResponse {
    const timestamp = new Date().toISOString()
    const path = request.url
    const method = request.method
    const requestId = request.headers['x-request-id'] as string

    if (exception instanceof HttpException) {
      return this.handleHttpException(exception, { timestamp, path, method, requestId })
    }

    if (exception instanceof Error) {
      return this.handleGenericError(exception, { timestamp, path, method, requestId })
    }

    return this.handleUnknownError(exception, { timestamp, path, method, requestId })
  }

  private handleHttpException(
    exception: HttpException,
    context: { timestamp: string; path: string; method: string; requestId?: string }
  ): ErrorResponse {
    const status = exception.getStatus()
    const exceptionResponse = exception.getResponse()

    let message: string
    let details: any
    let code: string

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse
      code = this.getErrorCode(status)
    } else if (typeof exceptionResponse === 'object') {
      const response = exceptionResponse as any
      message = response.message || response.error || exception.message
      details = response.details
      code = response.code || this.getErrorCode(status)
    } else {
      message = exception.message
      code = this.getErrorCode(status)
    }

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code,
        message: Array.isArray(message) ? message.join(', ') : message,
        details,
        timestamp: context.timestamp,
        path: context.path,
        method: context.method,
        requestId: context.requestId,
      },
    }

    // 在开发环境中包含堆栈跟踪
    if (this.shouldIncludeStack()) {
      errorResponse.error.stack = exception.stack
    }

    return errorResponse
  }

  private handleGenericError(
    error: Error,
    context: { timestamp: string; path: string; method: string; requestId?: string }
  ): ErrorResponse {
    const code = this.categorizeError(error)
    const message = this.sanitizeErrorMessage(error.message)

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
        timestamp: context.timestamp,
        path: context.path,
        method: context.method,
        requestId: context.requestId,
      },
    }

    if (this.shouldIncludeStack()) {
      errorResponse.error.stack = error.stack
    }

    return errorResponse
  }

  private handleUnknownError(
    exception: unknown,
    context: { timestamp: string; path: string; method: string; requestId?: string }
  ): ErrorResponse {
    return {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '服务器内部错误',
        timestamp: context.timestamp,
        path: context.path,
        method: context.method,
        requestId: context.requestId,
      },
    }
  }

  private getHttpStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus()
    }
    return HttpStatus.INTERNAL_SERVER_ERROR
  }

  private getErrorCode(status: number): string {
    const statusCodeMap: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
      504: 'GATEWAY_TIMEOUT',
    }
    return statusCodeMap[status] || 'UNKNOWN_ERROR'
  }

  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase()

    if (message.includes('enoent') || message.includes('file not found')) {
      return 'FILE_NOT_FOUND'
    }
    if (message.includes('eacces') || message.includes('permission denied')) {
      return 'PERMISSION_DENIED'
    }
    if (message.includes('enospc') || message.includes('no space left')) {
      return 'DISK_FULL'
    }
    if (message.includes('timeout') || message.includes('etimedout')) {
      return 'TIMEOUT'
    }
    if (message.includes('connection') || message.includes('econnrefused')) {
      return 'CONNECTION_ERROR'
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return 'VALIDATION_ERROR'
    }
    if (message.includes('duplicate') || message.includes('unique')) {
      return 'DUPLICATE_ERROR'
    }

    return 'INTERNAL_SERVER_ERROR'
  }

  private sanitizeErrorMessage(message: string): string {
    // 移除敏感信息，如文件路径、密码等
    return message
      .replace(/\/[^\s]*\/[^\s]*/g, '[PATH]') // 替换文件路径
      .replace(/password[=:]\s*[^\s]*/gi, 'password=[HIDDEN]') // 隐藏密码
      .replace(/token[=:]\s*[^\s]*/gi, 'token=[HIDDEN]') // 隐藏令牌
      .replace(/key[=:]\s*[^\s]*/gi, 'key=[HIDDEN]') // 隐藏密钥
  }

  private shouldIncludeStack(): boolean {
    const nodeEnv = this.configService.get<string>('NODE_ENV')
    const enableStackTrace = this.configService.get<boolean>('ENABLE_ERROR_STACK_TRACE')
    return nodeEnv === 'development' || enableStackTrace === true
  }

  private logError(exception: unknown, request: Request, errorResponse: ErrorResponse): void {
    const { error } = errorResponse
    const userAgent = request.headers['user-agent']
    const ip = request.ip || request.connection.remoteAddress

    const logContext = {
      requestId: error.requestId,
      method: error.method,
      path: error.path,
      userAgent,
      ip,
      body: this.sanitizeRequestBody(request.body),
      query: request.query,
      params: request.params,
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      if (status >= 500) {
        this.logger.error(
          `HTTP ${status} - ${error.message}`,
          exception.stack,
          JSON.stringify(logContext)
        )
      } else if (status >= 400) {
        this.logger.warn(`HTTP ${status} - ${error.message}`, JSON.stringify(logContext))
      }
    } else {
      this.logger.error(
        `Unhandled Exception - ${error.message}`,
        exception instanceof Error ? exception.stack : 'No stack trace',
        JSON.stringify(logContext)
      )
    }
  }

  private recordErrorMetrics(exception: unknown, request: Request): void {
    try {
      const errorType =
        exception instanceof HttpException
          ? this.getErrorCode(exception.getStatus())
          : this.categorizeError(exception as Error)

      // 异步记录错误统计，不阻塞响应
      setImmediate(() => {
        if (this.monitoringService) {
          this.monitoringService
            .logFileAccess({
              fileId: 'error',
              fileName: request.path,
              filePath: request.path,
              accessType: 'read',
              userAgent: request.headers['user-agent'] || 'unknown',
              ipAddress: request.ip || 'unknown',
              errorMessage: exception instanceof Error ? exception.message : 'Unknown error',
            })
            .catch(err => {
              this.logger.warn('Failed to record error metrics', err)
            })
        }
      })
    } catch (error) {
      // 忽略监控记录错误，避免循环错误
      this.logger.warn('Failed to record error metrics', error)
    }
  }

  private sanitizeRequestBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body
    }

    const sanitized = { ...body }
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization']

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[HIDDEN]'
      }
    }

    return sanitized
  }
}
