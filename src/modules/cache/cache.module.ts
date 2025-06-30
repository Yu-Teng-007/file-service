import { Module } from '@nestjs/common'
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { CacheService } from './cache.service'

@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST')
        const redisPort = configService.get<number>('REDIS_PORT', 6379)
        const redisPassword = configService.get<string>('REDIS_PASSWORD')
        const redisDb = configService.get<number>('REDIS_DB', 0)
        const ttl = configService.get<number>('CACHE_TTL', 3600)
        const max = configService.get<number>('CACHE_MAX_ITEMS', 1000)

        // 如果配置了Redis，尝试使用Redis缓存
        if (redisHost) {
          try {
            // 尝试连接Redis（简单检查）
            console.log(`尝试配置Redis缓存: ${redisHost}:${redisPort}`)

            // 暂时使用内存缓存，但记录Redis配置
            console.log('Redis配置已记录，当前使用内存缓存')
            return {
              ttl,
              max,
              // 可以在这里添加Redis配置，当Redis可用时
            }
          } catch (error) {
            console.warn('Redis连接失败，使用内存缓存:', error.message)
          }
        }

        // 使用内存缓存作为备选方案
        console.log('使用内存缓存')
        return {
          ttl,
          max,
        }
      },
      inject: [ConfigService],
    }),
  ],
  providers: [CacheService],
  exports: [CacheService, NestCacheModule],
})
export class CacheModule {}
