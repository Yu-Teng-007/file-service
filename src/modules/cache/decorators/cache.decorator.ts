import { SetMetadata } from '@nestjs/common'

export const CACHE_KEY_METADATA = 'cache:key'
export const CACHE_TTL_METADATA = 'cache:ttl'
export const CACHE_TAGS_METADATA = 'cache:tags'

/**
 * 缓存装饰器
 * @param key 缓存键模板，支持参数替换，如 'file:${id}'
 * @param ttl 生存时间（秒）
 * @param tags 缓存标签
 */
export const Cacheable = (key: string, ttl = 3600, tags?: string[]) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(CACHE_KEY_METADATA, key)(target, propertyKey, descriptor)
    SetMetadata(CACHE_TTL_METADATA, ttl)(target, propertyKey, descriptor)
    if (tags) {
      SetMetadata(CACHE_TAGS_METADATA, tags)(target, propertyKey, descriptor)
    }
    return descriptor
  }
}

/**
 * 缓存清理装饰器
 * @param patterns 要清理的缓存键模式或标签
 */
export const CacheEvict = (patterns: string | string[]) => {
  return SetMetadata('cache:evict', Array.isArray(patterns) ? patterns : [patterns])
}
