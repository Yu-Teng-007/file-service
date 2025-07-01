import { Injectable, NestMiddleware, Logger } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'

@Injectable()
export class ErrorHandlingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ErrorHandlingMiddleware.name)

  use(req: Request, res: Response, next: NextFunction): void {
    // 为每个请求生成唯一ID
    const requestId = uuidv4()
    req.headers['x-request-id'] = requestId

    // 记录请求开始时间
    const startTime = Date.now()

    // 监听响应完成事件
    res.on('finish', () => {
      const duration = Date.now() - startTime
      const { method, originalUrl, ip } = req
      const { statusCode } = res
      const userAgent = req.get('User-Agent') || 'unknown'

      // 根据状态码决定日志级别
      if (statusCode >= 500) {
        this.logger.error(
          `${method} ${originalUrl} ${statusCode} - ${duration}ms`,
          {
            requestId,
            method,
            url: originalUrl,
            statusCode,
            duration,
            ip,
            userAgent,
          }
        )
      } else if (statusCode >= 400) {
        this.logger.warn(
          `${method} ${originalUrl} ${statusCode} - ${duration}ms`,
          {
            requestId,
            method,
            url: originalUrl,
            statusCode,
            duration,
            ip,
            userAgent,
          }
        )
      } else {
        this.logger.log(
          `${method} ${originalUrl} ${statusCode} - ${duration}ms`,
          {
            requestId,
            method,
            url: originalUrl,
            statusCode,
            duration,
            ip,
            userAgent,
          }
        )
      }
    })

    // 监听响应错误事件
    res.on('error', (error) => {
      this.logger.error(
        `Response error for ${req.method} ${req.originalUrl}`,
        error.stack,
        {
          requestId,
          method: req.method,
          url: req.originalUrl,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        }
      )
    })

    next()
  }
}
