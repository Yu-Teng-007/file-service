import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { CacheService } from '../cache.service'

@Injectable()
export class CacheEvictInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheEvictInterceptor.name)

  constructor(
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const evictPatterns = this.reflector.get<string[]>('cache:evict', context.getHandler())
    
    if (!evictPatterns || evictPatterns.length === 0) {
      return next.handle()
    }

    return next.handle().pipe(
      tap(async () => {
        const request = context.switchToHttp().getRequest()
        const params = {
          ...request.params,
          ...request.query,
          ...request.body,
        }

        for (const pattern of evictPatterns) {
          if (pattern.startsWith('tag:')) {
            // 清理标签缓存
            const tag = pattern.substring(4)
            await this.cacheService.clearByTag(tag)
            this.logger.debug(`已清理标签缓存: ${tag}`)
          } else {
            // 清理具体键
            const resolvedKey = this.resolveCacheKey(pattern, params)
            await this.cacheService.del(resolvedKey)
            this.logger.debug(`已清理缓存: ${resolvedKey}`)
          }
        }
      }),
    )
  }

  /**
   * 解析缓存键中的参数
   */
  private resolveCacheKey(template: string, params: Record<string, any>): string {
    let resolved = template
    for (const [key, value] of Object.entries(params)) {
      resolved = resolved.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), String(value))
    }
    return resolved
  }
}
