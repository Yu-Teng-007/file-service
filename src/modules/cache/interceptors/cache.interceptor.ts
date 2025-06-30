import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable, of } from 'rxjs'
import { tap } from 'rxjs/operators'
import { CacheService } from '../cache.service'
import {
  CACHE_KEY_METADATA,
  CACHE_TTL_METADATA,
  CACHE_TAGS_METADATA,
} from '../decorators/cache.decorator'

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name)

  constructor(
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const cacheKey = this.reflector.get<string>(CACHE_KEY_METADATA, context.getHandler())
    
    if (!cacheKey) {
      return next.handle()
    }

    const ttl = this.reflector.get<number>(CACHE_TTL_METADATA, context.getHandler()) || 3600
    const tags = this.reflector.get<string[]>(CACHE_TAGS_METADATA, context.getHandler())

    // 解析缓存键中的参数
    const request = context.switchToHttp().getRequest()
    const resolvedKey = this.resolveCacheKey(cacheKey, {
      ...request.params,
      ...request.query,
      ...request.body,
    })

    // 尝试从缓存获取数据
    const cachedResult = await this.cacheService.get(resolvedKey)
    if (cachedResult !== undefined) {
      this.logger.debug(`缓存命中: ${resolvedKey}`)
      return of(cachedResult)
    }

    // 缓存未命中，执行原方法并缓存结果
    return next.handle().pipe(
      tap(async (result) => {
        if (result !== undefined) {
          await this.cacheService.set(resolvedKey, result, { ttl, tags })
          this.logger.debug(`结果已缓存: ${resolvedKey}`)
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
