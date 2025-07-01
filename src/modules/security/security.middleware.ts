import { Injectable, NestMiddleware, Logger } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { AccessControlService } from './access-control.service'
import { RateLimitService } from './rate-limit.service'

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name)

  constructor(
    private readonly accessControlService: AccessControlService,
    private readonly rateLimitService: RateLimitService
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startTime = Date.now()
      
      // 构建上下文
      const context = {
        ipAddress: this.getClientIP(req),
        userAgent: req.headers['user-agent'] || 'unknown',
        endpoint: req.path,
        method: req.method,
        timestamp: new Date(),
        userId: this.extractUserId(req),
        requestHeaders: req.headers as Record<string, string>,
      }

      // 1. 访问控制检查
      const accessContext = {
        ...context,
        operation: this.mapMethodToOperation(req.method),
      }

      const hasAccess = await this.accessControlService.checkAccess(accessContext)
      if (!hasAccess) {
        this.logger.warn(`访问被拒绝: ${context.method} ${context.endpoint} 来自 ${context.ipAddress}`)
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: '访问被拒绝',
            timestamp: new Date().toISOString(),
          },
        })
        return
      }

      // 2. 速率限制检查
      try {
        const rateLimitInfo = await this.rateLimitService.checkLimit(context)
        
        // 添加速率限制头部
        if (rateLimitInfo) {
          res.setHeader('X-RateLimit-Limit', rateLimitInfo.limit)
          res.setHeader('X-RateLimit-Remaining', rateLimitInfo.remaining)
          res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitInfo.resetTime.getTime() / 1000))
          res.setHeader('X-RateLimit-Window', rateLimitInfo.windowMs)
        }
      } catch (error) {
        if (error.message?.includes('超过限制')) {
          this.logger.warn(`请求超过速率限制: ${context.method} ${context.endpoint} 来自 ${context.ipAddress}`)
          res.status(429).json({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: '请求频率超过限制',
              timestamp: new Date().toISOString(),
              details: error.details || {},
            },
          })
          return
        }
        throw error
      }

      // 3. 添加安全头部
      this.addSecurityHeaders(res)

      // 4. 记录请求处理时间
      res.on('finish', () => {
        const duration = Date.now() - startTime
        this.logger.debug(
          `安全检查完成: ${context.method} ${context.endpoint} - ${duration}ms`,
          { context, duration }
        )
      })

      next()
    } catch (error) {
      this.logger.error('安全中间件处理失败', error)
      res.status(500).json({
        success: false,
        error: {
          code: 'SECURITY_CHECK_FAILED',
          message: '安全检查失败',
          timestamp: new Date().toISOString(),
        },
      })
    }
  }

  /**
   * 获取客户端真实IP
   */
  private getClientIP(req: Request): string {
    const forwarded = req.headers['x-forwarded-for']
    const realIP = req.headers['x-real-ip']
    const cfConnectingIP = req.headers['cf-connecting-ip']
    
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim()
    }
    
    if (typeof realIP === 'string') {
      return realIP
    }
    
    if (typeof cfConnectingIP === 'string') {
      return cfConnectingIP
    }
    
    return req.ip || req.connection.remoteAddress || 'unknown'
  }

  /**
   * 提取用户ID
   */
  private extractUserId(req: Request): string | undefined {
    // 从JWT token中提取用户ID
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        // 这里应该解析JWT token获取用户ID
        // 简化实现，实际应该使用JWT库
        const token = authHeader.substring(7)
        // const decoded = jwt.verify(token, secret)
        // return decoded.userId
      } catch (error) {
        // Token无效，忽略
      }
    }

    // 从API Key中提取用户信息（如果有的话）
    const apiKey = req.headers['x-api-key']
    if (apiKey) {
      // 这里可以根据API Key查找对应的用户
      // return await this.getUserByApiKey(apiKey)
    }

    return undefined
  }

  /**
   * 将HTTP方法映射到操作类型
   */
  private mapMethodToOperation(method: string): 'read' | 'write' | 'delete' | 'upload' | 'download' {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'read'
      case 'POST':
        return 'write'
      case 'PUT':
      case 'PATCH':
        return 'write'
      case 'DELETE':
        return 'delete'
      default:
        return 'read'
    }
  }

  /**
   * 添加安全头部
   */
  private addSecurityHeaders(res: Response): void {
    // 防止点击劫持
    res.setHeader('X-Frame-Options', 'DENY')
    
    // 防止MIME类型嗅探
    res.setHeader('X-Content-Type-Options', 'nosniff')
    
    // XSS保护
    res.setHeader('X-XSS-Protection', '1; mode=block')
    
    // 引用者策略
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    
    // 权限策略
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    
    // 严格传输安全（仅在HTTPS下）
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }
    
    // 内容安全策略（针对文件服务调整）
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob:; " +
      "font-src 'self'; " +
      "connect-src 'self'; " +
      "media-src 'self'; " +
      "object-src 'none'; " +
      "frame-src 'none';"
    )
  }
}
