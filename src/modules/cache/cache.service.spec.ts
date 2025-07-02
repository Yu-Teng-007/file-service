import { Test, TestingModule } from '@nestjs/testing'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { CacheService } from './cache.service'

describe('CacheService', () => {
  let service: CacheService
  let cacheManager: any

  beforeEach(async () => {
    const mockCacheManager = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      reset: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile()

    service = module.get<CacheService>(CacheService)
    cacheManager = module.get(CACHE_MANAGER)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('set', () => {
    it('should set cache with default TTL', async () => {
      const key = 'test-key'
      const value = { data: 'test' }

      await service.set(key, value)

      expect(cacheManager.set).toHaveBeenCalledWith(key, value, 3600)
    })

    it('should set cache with custom TTL', async () => {
      const key = 'test-key'
      const value = { data: 'test' }
      const ttl = 1800

      await service.set(key, value, { ttl })

      expect(cacheManager.set).toHaveBeenCalledWith(key, value, ttl)
    })
  })

  describe('get', () => {
    it('should get cache value', async () => {
      const key = 'test-key'
      const value = { data: 'test' }
      cacheManager.get.mockResolvedValue(value)

      const result = await service.get(key)

      expect(result).toEqual(value)
      expect(cacheManager.get).toHaveBeenCalledWith(key)
    })

    it('should return undefined for non-existent key', async () => {
      const key = 'non-existent-key'
      cacheManager.get.mockResolvedValue(undefined)

      const result = await service.get(key)

      expect(result).toBeUndefined()
    })
  })

  describe('del', () => {
    it('should delete cache', async () => {
      const key = 'test-key'

      await service.del(key)

      expect(cacheManager.del).toHaveBeenCalledWith(key)
    })
  })

  describe('cacheFileMetadata', () => {
    it('should cache file metadata', async () => {
      const fileId = 'file-123'
      const metadata = {
        id: fileId,
        filename: 'test.jpg',
        originalName: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        category: 'images',
        accessLevel: 'public',
        uploadedAt: new Date(),
      }

      await service.cacheFileMetadata(fileId, metadata)

      expect(cacheManager.set).toHaveBeenCalledWith(`file:metadata:${fileId}`, metadata, 3600)
    })
  })

  describe('getFileMetadata', () => {
    it('should get file metadata from cache', async () => {
      const fileId = 'file-123'
      const metadata = {
        id: fileId,
        filename: 'test.jpg',
        originalName: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        category: 'images',
        accessLevel: 'public',
        uploadedAt: new Date(),
      }
      cacheManager.get.mockResolvedValue(metadata)

      const result = await service.getFileMetadata(fileId)

      expect(result).toEqual(metadata)
      expect(cacheManager.get).toHaveBeenCalledWith(`file:metadata:${fileId}`)
    })
  })

  describe('incrementFileAccess', () => {
    it('should increment file access count', async () => {
      const fileId = 'file-123'
      cacheManager.get.mockResolvedValue(5)

      const result = await service.incrementFileAccess(fileId)

      expect(result).toBe(6)
      expect(cacheManager.set).toHaveBeenCalledWith(`file:access:${fileId}`, 6, 86400)
    })

    it('should start count at 1 for new file', async () => {
      const fileId = 'file-new'
      cacheManager.get.mockResolvedValue(undefined)

      const result = await service.incrementFileAccess(fileId)

      expect(result).toBe(1)
      expect(cacheManager.set).toHaveBeenCalledWith(`file:access:${fileId}`, 1, 86400)
    })
  })

  describe('invalidateFileCache', () => {
    it('should invalidate file metadata cache', async () => {
      const fileId = 'file-123'

      await service.invalidateFileCache(fileId)

      expect(cacheManager.del).toHaveBeenCalledWith(`file:metadata:${fileId}`)
      expect(cacheManager.del).toHaveBeenCalledWith(`file:access:${fileId}`)
    })
  })

  describe('invalidateByPattern', () => {
    it('should invalidate cache by pattern', async () => {
      const pattern = 'file:*'

      await service.invalidateByPattern(pattern)

      // Since we're using a mock cache manager, we can't test the actual pattern matching
      // but we can verify the method was called
      expect(cacheManager.del).toHaveBeenCalled()
    })
  })

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      const stats = await service.getStats()

      expect(stats).toEqual({
        hits: 0,
        misses: 0,
        hitRate: 0,
        totalRequests: 0,
        memoryUsage: 0,
        keyCount: 0,
      })
    })
  })

  describe('clear', () => {
    it('should clear all cache', async () => {
      await service.clear()

      expect(cacheManager.reset).toHaveBeenCalled()
    })
  })

  describe('healthCheck', () => {
    it('should return healthy status when cache is working', async () => {
      cacheManager.set.mockResolvedValue(undefined)
      cacheManager.get.mockResolvedValue('test-value')
      cacheManager.del.mockResolvedValue(undefined)

      const result = await service.healthCheck()

      expect(result).toEqual({
        status: 'healthy',
        latency: expect.any(Number),
        timestamp: expect.any(Date),
      })
    })

    it('should return unhealthy status when cache fails', async () => {
      cacheManager.set.mockRejectedValue(new Error('Cache error'))

      const result = await service.healthCheck()

      expect(result).toEqual({
        status: 'unhealthy',
        error: 'Cache error',
        timestamp: expect.any(Date),
      })
    })
  })

  describe('error handling', () => {
    it('should handle cache set errors gracefully', async () => {
      const key = 'test-key'
      const value = { data: 'test' }
      cacheManager.set.mockRejectedValue(new Error('Cache set error'))

      // Should not throw, just log the error
      await expect(service.set(key, value)).resolves.not.toThrow()
    })

    it('should handle cache get errors gracefully', async () => {
      const key = 'test-key'
      cacheManager.get.mockRejectedValue(new Error('Cache get error'))

      const result = await service.get(key)

      expect(result).toBeUndefined()
    })

    it('should handle cache delete errors gracefully', async () => {
      const key = 'test-key'
      cacheManager.del.mockRejectedValue(new Error('Cache delete error'))

      // Should not throw, just log the error
      await expect(service.del(key)).resolves.not.toThrow()
    })
  })
})
