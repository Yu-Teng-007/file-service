import { Module } from '@nestjs/common'
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { redisStore } from 'cache-manager-redis-store'
import { CacheService } from './cache.service'

@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisConfig = {
          store: redisStore,
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
          db: configService.get<number>('REDIS_DB', 0),
          ttl: configService.get<number>('CACHE_TTL', 3600), // 1小时默认TTL
          max: configService.get<number>('CACHE_MAX_ITEMS', 1000), // 最大缓存项数
        }

        // 如果没有配置Redis，则使用内存缓存
        if (!configService.get<string>('REDIS_HOST')) {
          console.warn('Redis未配置，使用内存缓存')
          return {
            ttl: redisConfig.ttl,
            max: redisConfig.max,
          }
        }

        return redisConfig
      },
      inject: [ConfigService],
    }),
  ],
  providers: [CacheService],
  exports: [CacheService, NestCacheModule],
})
export class CacheModule {}
