import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { Request } from 'express'
import { API_KEY_AUTH_METADATA } from '../decorators/api-key-auth.decorator'

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // 检查是否需要 API Key 验证
    const requiresApiKey = this.reflector.getAllAndOverride<boolean>(API_KEY_AUTH_METADATA, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiresApiKey) {
      return true
    }

    const request = context.switchToHttp().getRequest<Request>()
    const apiKey = this.extractApiKeyFromHeader(request)

    if (!apiKey) {
      this.logger.warn(`API Key 验证失败: 缺少 X-API-Key 头部`)
      throw new UnauthorizedException('缺少 API Key，请在请求头中提供 X-API-Key')
    }

    const validApiKey = this.configService.get<string>('app.apiKey')

    if (!validApiKey) {
      this.logger.error('服务器配置错误: API_KEY 未设置')
      throw new UnauthorizedException('服务器配置错误')
    }

    if (apiKey !== validApiKey) {
      this.logger.warn(`API Key 验证失败: 无效的 API Key - ${apiKey}`)
      throw new UnauthorizedException('无效的 API Key')
    }

    this.logger.debug(`API Key 验证成功`)
    return true
  }

  /**
   * 从请求头中提取 API Key
   */
  private extractApiKeyFromHeader(request: Request): string | undefined {
    // 支持多种头部格式
    const apiKey =
      request.headers['x-api-key'] ||
      request.headers['X-API-Key'] ||
      request.headers['X-Api-Key'] ||
      request.headers['api-key']

    return Array.isArray(apiKey) ? apiKey[0] : apiKey
  }
}
