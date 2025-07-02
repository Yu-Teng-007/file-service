import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { NotFoundException, ConflictException } from '@nestjs/common'
import { FileStorageService } from './file-storage.service'
import { CDNService } from '../cdn/cdn.service'
import { FileCategory, FileAccessLevel, FileReadMode } from '../../types/file.types'
import * as fs from 'fs'
import * as path from 'path'

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    rename: jest.fn(),
    stat: jest.fn(),
    access: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    readdir: jest.fn(),
    open: jest.fn(),
  },
  constants: {
    F_OK: 0,
  },
}))

describe('FileStorageService', () => {
  let service: FileStorageService
  let configService: jest.Mocked<ConfigService>
  let cdnService: jest.Mocked<CDNService>
  let consoleWarnSpy: jest.SpyInstance

  const mockFileInfo = {
    id: 'test-file-id',
    originalName: 'test.jpg',
    filename: 'test.jpg',
    path: '/uploads/images/test.jpg',
    url: '/uploads/images/test.jpg',
    category: FileCategory.IMAGE,
    accessLevel: FileAccessLevel.PUBLIC,
    size: 1024,
    mimeType: 'image/jpeg',
    uploadedAt: new Date(),
    checksum: 'abc123',
  }

  beforeEach(async () => {
    // Mock console.warn to suppress expected warnings
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    // Mock file system operations first
    ;(fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined)
    ;(fs.promises.rename as jest.Mock).mockResolvedValue(undefined)
    ;(fs.promises.readFile as jest.Mock).mockResolvedValue('{}') // Default empty metadata
    ;(fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined)

    const mockConfigService = {
      get: jest.fn(),
    }

    const mockCDNService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
      getFileUrl: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileStorageService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CDNService, useValue: mockCDNService },
      ],
    }).compile()

    service = module.get<FileStorageService>(FileStorageService)
    configService = module.get(ConfigService)
    cdnService = module.get(CDNService)

    // Setup default config values
    configService.get.mockImplementation((key: string) => {
      const config = {
        UPLOAD_DIR: 'uploads',
        CDN_PROVIDER: 'local',
      }
      return config[key]
    })
    ;(fs.promises.stat as jest.Mock).mockResolvedValue({
      size: 1024,
      isFile: () => true,
      isDirectory: () => false,
      mtime: new Date(),
    })
    ;(fs.promises.readFile as jest.Mock).mockResolvedValue('{}')
    ;(fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined)
    ;(fs.promises.unlink as jest.Mock).mockResolvedValue(undefined)
  })

  afterEach(() => {
    // Restore console.warn
    consoleWarnSpy?.mockRestore()
    jest.clearAllMocks()
  })

  describe('storeFile', () => {
    it('should store file successfully', async () => {
      ;(fs.promises.access as jest.Mock).mockRejectedValue(new Error('File not found'))

      const result = await service.storeFile(
        '/tmp/temp-file.jpg',
        'test.jpg',
        FileCategory.IMAGE,
        { accessLevel: FileAccessLevel.PUBLIC },
        { mimeType: 'image/jpeg', checksum: 'abc123' }
      )

      expect(result).toMatchObject({
        originalName: 'test.jpg',
        category: FileCategory.IMAGE,
        accessLevel: FileAccessLevel.PUBLIC,
        size: 1024,
        mimeType: 'image/jpeg',
        checksum: 'abc123',
      })

      expect(fs.promises.mkdir).toHaveBeenCalled()
      expect(fs.promises.rename).toHaveBeenCalledWith(
        '/tmp/temp-file.jpg',
        expect.stringMatching(/uploads[\/\\]images[\/\\]/)
      )
    })

    it('should throw ConflictException when file exists and overwrite is false', async () => {
      ;(fs.promises.access as jest.Mock).mockResolvedValue(undefined) // File exists

      await expect(
        service.storeFile(
          '/tmp/temp-file.jpg',
          'test.jpg',
          FileCategory.IMAGE,
          { accessLevel: FileAccessLevel.PUBLIC, overwrite: false },
          { mimeType: 'image/jpeg' }
        )
      ).rejects.toThrow(ConflictException)
    })

    it('should overwrite file when overwrite is true', async () => {
      ;(fs.promises.access as jest.Mock).mockResolvedValue(undefined) // File exists

      const result = await service.storeFile(
        '/tmp/temp-file.jpg',
        'test.jpg',
        FileCategory.IMAGE,
        { accessLevel: FileAccessLevel.PUBLIC, overwrite: true },
        { mimeType: 'image/jpeg' }
      )

      expect(result).toBeDefined()
      expect(fs.promises.rename).toHaveBeenCalled()
    })

    it('should use custom path when provided', async () => {
      ;(fs.promises.access as jest.Mock).mockRejectedValue(new Error('File not found'))

      const result = await service.storeFile(
        '/tmp/temp-file.jpg',
        'test.jpg',
        FileCategory.IMAGE,
        { accessLevel: FileAccessLevel.PUBLIC, customPath: 'custom-name' },
        { mimeType: 'image/jpeg' }
      )

      expect(result.filename).toBe('custom-name.jpg')
    })
  })

  describe('getFileInfo', () => {
    beforeEach(() => {
      // Mock metadata file content
      const metadata = {
        'test-file-id': {
          id: 'test-file-id',
          originalName: 'test.jpg',
          filename: 'test.jpg',
          path: '/uploads/images/test.jpg',
          url: '/uploads/images/test.jpg',
          category: FileCategory.IMAGE,
          accessLevel: FileAccessLevel.PUBLIC,
          size: 1024,
          mimeType: 'image/jpeg',
          uploadedAt: new Date().toISOString(),
          checksum: 'abc123',
        },
      }
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(JSON.stringify(metadata))
    })

    it('should return file info when file exists', async () => {
      // Manually add metadata to the service's internal map
      const metadata = {
        id: 'test-file-id',
        originalName: 'test.jpg',
        filename: 'test.jpg',
        path: '/uploads/images/test.jpg',
        url: '/uploads/images/test.jpg',
        category: FileCategory.IMAGE,
        accessLevel: FileAccessLevel.PUBLIC,
        size: 1024,
        mimeType: 'image/jpeg',
        uploadedAt: new Date().toISOString(),
        checksum: 'abc123',
      }

      // Access the private fileMetadata map and set the data
      ;(service as any).fileMetadata.set('test-file-id', metadata)

      const result = await service.getFileInfo('test-file-id')

      expect(result).toMatchObject({
        id: 'test-file-id',
        originalName: 'test.jpg',
        filename: 'test.jpg',
        category: FileCategory.IMAGE,
        accessLevel: FileAccessLevel.PUBLIC,
        size: 1024,
        mimeType: 'image/jpeg',
        checksum: 'abc123',
      })
      expect(result.uploadedAt).toBeInstanceOf(Date)
    })

    it('should return null when file does not exist', async () => {
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue('{}')

      const result = await service.getFileInfo('non-existent-id')

      expect(result).toBeNull()
    })
  })

  describe('updateFileInfo', () => {
    beforeEach(() => {
      // Mock existing metadata
      const metadata = {
        'test-file-id': {
          id: 'test-file-id',
          originalName: 'test.jpg',
          filename: 'test.jpg',
          path: '/uploads/images/test.jpg',
          url: '/uploads/images/test.jpg',
          category: FileCategory.IMAGE,
          accessLevel: FileAccessLevel.PUBLIC,
          size: 1024,
          mimeType: 'image/jpeg',
          uploadedAt: new Date().toISOString(),
          checksum: 'abc123',
        },
      }
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(JSON.stringify(metadata))
    })

    it('should update file info successfully', async () => {
      // Set up metadata first
      const metadata = {
        id: 'test-file-id',
        originalName: 'test.jpg',
        filename: 'test.jpg',
        path: '/uploads/images/test.jpg',
        url: '/uploads/images/test.jpg',
        category: FileCategory.IMAGE,
        accessLevel: FileAccessLevel.PUBLIC,
        size: 1024,
        mimeType: 'image/jpeg',
        uploadedAt: new Date().toISOString(),
        checksum: 'abc123',
      }
      ;(service as any).fileMetadata.set('test-file-id', metadata)

      const updates = {
        filename: 'new-name.jpg',
        accessLevel: FileAccessLevel.PRIVATE,
      }

      const result = await service.updateFileInfo('test-file-id', updates)

      expect(result.filename).toBe('new-name.jpg')
      expect(result.accessLevel).toBe(FileAccessLevel.PRIVATE)
      expect(fs.promises.writeFile).toHaveBeenCalled()
    })

    it('should throw NotFoundException when file does not exist', async () => {
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue('{}')

      await expect(
        service.updateFileInfo('non-existent-id', { filename: 'new-name.jpg' })
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('deleteFile', () => {
    beforeEach(() => {
      // Mock existing metadata
      const metadata = {
        'test-file-id': {
          id: 'test-file-id',
          originalName: 'test.jpg',
          filename: 'test.jpg',
          path: '/uploads/images/test.jpg',
          url: '/uploads/images/test.jpg',
          category: FileCategory.IMAGE,
          accessLevel: FileAccessLevel.PUBLIC,
          size: 1024,
          mimeType: 'image/jpeg',
          uploadedAt: new Date().toISOString(),
          checksum: 'abc123',
        },
      }
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(JSON.stringify(metadata))
    })

    it('should delete file successfully', async () => {
      // Set up metadata first
      const metadata = {
        id: 'test-file-id',
        originalName: 'test.jpg',
        filename: 'test.jpg',
        path: '/uploads/images/test.jpg',
        url: '/uploads/images/test.jpg',
        category: FileCategory.IMAGE,
        accessLevel: FileAccessLevel.PUBLIC,
        size: 1024,
        mimeType: 'image/jpeg',
        uploadedAt: new Date().toISOString(),
        checksum: 'abc123',
      }
      ;(service as any).fileMetadata.set('test-file-id', metadata)

      await service.deleteFile('test-file-id')

      expect(fs.promises.unlink).toHaveBeenCalledWith('/uploads/images/test.jpg')
      expect(fs.promises.writeFile).toHaveBeenCalled() // Metadata update
    })

    it('should throw NotFoundException when file does not exist', async () => {
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue('{}')

      await expect(service.deleteFile('non-existent-id')).rejects.toThrow(NotFoundException)
    })

    it('should continue deletion even if physical file removal fails', async () => {
      // Set up metadata first
      const metadata = {
        id: 'test-file-id',
        originalName: 'test.jpg',
        filename: 'test.jpg',
        path: '/uploads/images/test.jpg',
        url: '/uploads/images/test.jpg',
        category: FileCategory.IMAGE,
        accessLevel: FileAccessLevel.PUBLIC,
        size: 1024,
        mimeType: 'image/jpeg',
        uploadedAt: new Date().toISOString(),
        checksum: 'abc123',
      }
      ;(service as any).fileMetadata.set('test-file-id', metadata)
      ;(fs.promises.unlink as jest.Mock).mockRejectedValue(new Error('File not found'))

      // Should not throw, just log warning
      await expect(service.deleteFile('test-file-id')).resolves.not.toThrow()
      expect(fs.promises.writeFile).toHaveBeenCalled() // Metadata should still be updated
    })
  })

  describe('searchFiles', () => {
    beforeEach(async () => {
      // Set up metadata directly in the service
      const metadata1 = {
        id: 'file-1',
        originalName: 'image1.jpg',
        filename: 'image1.jpg',
        path: '/uploads/images/image1.jpg',
        url: '/uploads/images/image1.jpg',
        category: FileCategory.IMAGE,
        accessLevel: FileAccessLevel.PUBLIC,
        size: 1024,
        mimeType: 'image/jpeg',
        uploadedAt: new Date('2023-01-01').toISOString(),
        checksum: 'abc123',
      }
      const metadata2 = {
        id: 'file-2',
        originalName: 'script.js',
        filename: 'script.js',
        path: '/uploads/scripts/script.js',
        url: '/uploads/scripts/script.js',
        category: FileCategory.SCRIPT,
        accessLevel: FileAccessLevel.PRIVATE,
        size: 2048,
        mimeType: 'application/javascript',
        uploadedAt: new Date('2023-01-02').toISOString(),
        checksum: 'def456',
      }
      const metadata3 = {
        id: 'file-3',
        originalName: 'image2.png',
        filename: 'image2.png',
        path: '/uploads/images/image2.png',
        url: '/uploads/images/image2.png',
        category: FileCategory.IMAGE,
        accessLevel: FileAccessLevel.PUBLIC,
        size: 512,
        mimeType: 'image/png',
        uploadedAt: new Date('2023-01-03').toISOString(),
        checksum: 'ghi789',
      }

      // Clear existing metadata and set new ones
      ;(service as any).fileMetadata.clear()
      ;(service as any).fileMetadata.set('file-1', metadata1)
      ;(service as any).fileMetadata.set('file-2', metadata2)
      ;(service as any).fileMetadata.set('file-3', metadata3)
    })

    it('should search files by category', async () => {
      const query = {
        category: FileCategory.IMAGE,
        page: 1,
        limit: 10,
      }

      const result = await service.searchFiles(query)

      expect(result.files).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.files.every(file => file.category === FileCategory.IMAGE)).toBe(true)
    })

    it('should search files by filename', async () => {
      const query = {
        filename: 'script',
        page: 1,
        limit: 10,
      }

      const result = await service.searchFiles(query)

      expect(result.files).toHaveLength(1)
      expect(result.files[0].filename).toBe('script.js')
    })

    it('should paginate results correctly', async () => {
      const query = {
        page: 1,
        limit: 2,
      }

      const result = await service.searchFiles(query)

      expect(result.files).toHaveLength(2)
      expect(result.total).toBe(3)
      expect(result.totalPages).toBe(2)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(2)
    })

    it('should sort files by upload date descending by default', async () => {
      const query = {
        page: 1,
        limit: 10,
      }

      const result = await service.searchFiles(query)

      expect(result.files).toHaveLength(3)
      expect(new Date(result.files[0].uploadedAt).getTime()).toBeGreaterThan(
        new Date(result.files[1].uploadedAt).getTime()
      )
    })
  })

  describe('batchOperation', () => {
    beforeEach(() => {
      // Mock metadata with multiple files
      const metadata = {
        'file-1': {
          id: 'file-1',
          originalName: 'image1.jpg',
          filename: 'image1.jpg',
          path: '/uploads/images/image1.jpg',
          category: FileCategory.IMAGE,
          accessLevel: FileAccessLevel.PUBLIC,
          size: 1024,
          uploadedAt: new Date().toISOString(),
        },
        'file-2': {
          id: 'file-2',
          originalName: 'image2.jpg',
          filename: 'image2.jpg',
          path: '/uploads/images/image2.jpg',
          category: FileCategory.IMAGE,
          accessLevel: FileAccessLevel.PUBLIC,
          size: 2048,
          uploadedAt: new Date().toISOString(),
        },
      }
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(JSON.stringify(metadata))
    })

    it('should delete multiple files', async () => {
      // Set up metadata first
      const metadata1 = {
        id: 'file-1',
        originalName: 'image1.jpg',
        filename: 'image1.jpg',
        path: '/uploads/images/image1.jpg',
        url: '/uploads/images/image1.jpg',
        category: FileCategory.IMAGE,
        accessLevel: FileAccessLevel.PUBLIC,
        size: 1024,
        mimeType: 'image/jpeg',
        uploadedAt: new Date().toISOString(),
        checksum: 'abc123',
      }
      const metadata2 = {
        id: 'file-2',
        originalName: 'image2.jpg',
        filename: 'image2.jpg',
        path: '/uploads/images/image2.jpg',
        url: '/uploads/images/image2.jpg',
        category: FileCategory.IMAGE,
        accessLevel: FileAccessLevel.PUBLIC,
        size: 2048,
        mimeType: 'image/jpeg',
        uploadedAt: new Date().toISOString(),
        checksum: 'def456',
      }
      ;(service as any).fileMetadata.set('file-1', metadata1)
      ;(service as any).fileMetadata.set('file-2', metadata2)

      const operation = {
        action: 'delete' as const,
        fileIds: ['file-1', 'file-2'],
      }

      const result = await service.batchOperation(operation)

      expect(result.success).toBe(2)
      expect(result.processed).toBe(2)
      expect(fs.promises.unlink).toHaveBeenCalledTimes(2)
    })

    it('should update access level for multiple files', async () => {
      // Set up metadata first
      const metadata1 = {
        id: 'file-1',
        originalName: 'image1.jpg',
        filename: 'image1.jpg',
        path: '/uploads/images/image1.jpg',
        url: '/uploads/images/image1.jpg',
        category: FileCategory.IMAGE,
        accessLevel: FileAccessLevel.PUBLIC,
        size: 1024,
        mimeType: 'image/jpeg',
        uploadedAt: new Date().toISOString(),
        checksum: 'abc123',
      }
      const metadata2 = {
        id: 'file-2',
        originalName: 'image2.jpg',
        filename: 'image2.jpg',
        path: '/uploads/images/image2.jpg',
        url: '/uploads/images/image2.jpg',
        category: FileCategory.IMAGE,
        accessLevel: FileAccessLevel.PUBLIC,
        size: 2048,
        mimeType: 'image/jpeg',
        uploadedAt: new Date().toISOString(),
        checksum: 'def456',
      }
      ;(service as any).fileMetadata.set('file-1', metadata1)
      ;(service as any).fileMetadata.set('file-2', metadata2)

      const operation = {
        action: 'changeAccess' as const,
        fileIds: ['file-1', 'file-2'],
        targetAccessLevel: FileAccessLevel.PRIVATE,
      }

      const result = await service.batchOperation(operation)

      expect(result.success).toBe(2)
      expect(result.processed).toBe(2)
      expect(fs.promises.writeFile).toHaveBeenCalled()
    })

    it('should handle partial failures gracefully', async () => {
      // Set up metadata first
      const metadata1 = {
        id: 'file-1',
        originalName: 'image1.jpg',
        filename: 'image1.jpg',
        path: '/uploads/images/image1.jpg',
        url: '/uploads/images/image1.jpg',
        category: FileCategory.IMAGE,
        accessLevel: FileAccessLevel.PUBLIC,
        size: 1024,
        mimeType: 'image/jpeg',
        uploadedAt: new Date().toISOString(),
        checksum: 'abc123',
      }
      const metadata2 = {
        id: 'file-2',
        originalName: 'image2.jpg',
        filename: 'image2.jpg',
        path: '/uploads/images/image2.jpg',
        url: '/uploads/images/image2.jpg',
        category: FileCategory.IMAGE,
        accessLevel: FileAccessLevel.PUBLIC,
        size: 2048,
        mimeType: 'image/jpeg',
        uploadedAt: new Date().toISOString(),
        checksum: 'def456',
      }
      ;(service as any).fileMetadata.set('file-1', metadata1)
      // 不设置file-2的元数据，这样会导致NotFoundException
      ;(fs.promises.unlink as jest.Mock).mockResolvedValueOnce(undefined)

      const operation = {
        action: 'delete' as const,
        fileIds: ['file-1', 'file-2'],
      }

      const result = await service.batchOperation(operation)

      expect(result.success).toBe(1)
      expect(result.processed).toBe(2)
      expect(result.errors).toHaveLength(1)
    })
  })

  describe('File Content Reading', () => {
    beforeEach(() => {
      // Set up file metadata for reading tests
      ;(service as any).fileMetadata.set('test-read-id', {
        id: 'test-read-id',
        originalName: 'test.txt',
        filename: 'test-read-id.txt',
        path: 'test-uploads/documents/test-read-id.txt',
        url: '/uploads/documents/test-read-id.txt',
        category: FileCategory.DOCUMENT,
        accessLevel: FileAccessLevel.PUBLIC,
        size: 100,
        mimeType: 'text/plain',
        uploadedAt: '2023-01-01T00:00:00.000Z',
      })
    })

    describe('readFileContent', () => {
      it('should read full file content as buffer', async () => {
        const testContent = Buffer.from('Hello, World!')
        ;(fs.promises.access as jest.Mock).mockResolvedValue(undefined)
        ;(fs.promises.stat as jest.Mock).mockResolvedValue({ size: 13 })
        ;(fs.promises.readFile as jest.Mock).mockResolvedValue(testContent)

        const result = await service.readFileContent('test-read-id', {
          mode: FileReadMode.FULL,
          encoding: 'buffer',
        })

        expect(result.content).toEqual(testContent)
        expect(result.size).toBe(13)
        expect(result.mimeType).toBe('text/plain')
        expect(result.fromCache).toBe(false)
        expect(typeof result.readTime).toBe('number')
      })

      it('should read full file content as text', async () => {
        const testContent = 'Hello, World!'
        ;(fs.promises.access as jest.Mock).mockResolvedValue(undefined)
        ;(fs.promises.stat as jest.Mock).mockResolvedValue({ size: 13 })
        ;(fs.promises.readFile as jest.Mock).mockResolvedValue(testContent)

        const result = await service.readFileContent('test-read-id', {
          mode: FileReadMode.FULL,
          encoding: 'utf8',
        })

        expect(result.content).toBe(testContent)
        expect(result.size).toBe(13)
        expect(result.encoding).toBe('utf8')
      })

      it('should use cache when available', async () => {
        const testContent = 'Cached content'

        // Set up cache
        ;(service as any).contentCache.set('test-read-id:full:buffer:0:end', {
          content: testContent,
          timestamp: Date.now(),
          ttl: 300,
        })

        const result = await service.readFileContent('test-read-id', {
          useCache: true,
        })

        expect(result.content).toBe(testContent)
        expect(result.fromCache).toBe(true)
        expect(fs.promises.readFile).not.toHaveBeenCalled()
      })

      it('should throw error for non-existent file', async () => {
        await expect(service.readFileContent('non-existent-id')).rejects.toThrow(NotFoundException)
      })

      it('should throw error when file does not exist on disk', async () => {
        ;(fs.promises.access as jest.Mock).mockRejectedValue(new Error('File not found'))

        await expect(service.readFileContent('test-read-id')).rejects.toThrow(NotFoundException)
      })
    })

    describe('readFileChunks', () => {
      it('should read file in chunks', async () => {
        const mockFileHandle = {
          read: jest
            .fn()
            .mockResolvedValueOnce({ bytesRead: 5 })
            .mockResolvedValueOnce({ bytesRead: 8 }),
          close: jest.fn().mockResolvedValue(undefined),
        }

        ;(fs.promises.access as jest.Mock).mockResolvedValue(undefined)
        ;(fs.promises.stat as jest.Mock).mockResolvedValue({ size: 13 })
        ;(fs.promises.open as jest.Mock).mockResolvedValue(mockFileHandle)

        const chunks = []
        for await (const chunk of service.readFileChunks('test-read-id', {
          chunkSize: 5,
        })) {
          chunks.push(chunk)
        }

        expect(chunks).toHaveLength(3) // 13 bytes / 5 = 3 chunks
        expect(chunks[0].chunkIndex).toBe(0)
        expect(chunks[0].isLast).toBe(false)
        expect(chunks[2].isLast).toBe(true)
      })
    })

    describe('cache management', () => {
      it('should clean up expired cache entries', () => {
        const now = Date.now()

        // Add expired entry
        ;(service as any).contentCache.set('expired-key', {
          content: 'expired',
          timestamp: now - 400 * 1000, // 400 seconds ago
          ttl: 300, // 5 minutes TTL
        })

        // Add valid entry
        ;(service as any).contentCache.set('valid-key', {
          content: 'valid',
          timestamp: now - 100 * 1000, // 100 seconds ago
          ttl: 300,
        })
        ;(service as any).cleanupExpiredCache()

        expect((service as any).contentCache.has('expired-key')).toBe(false)
        expect((service as any).contentCache.has('valid-key')).toBe(true)
      })

      it('should clear all cache', () => {
        ;(service as any).contentCache.set('test-key', {
          content: 'test',
          timestamp: Date.now(),
          ttl: 300,
        })

        service.clearContentCache()

        expect((service as any).contentCache.size).toBe(0)
      })

      it('should return cache info', () => {
        ;(service as any).contentCache.set('test-key', {
          content: 'test',
          timestamp: Date.now(),
          ttl: 300,
        })

        const info = service.getCacheInfo()

        expect(info.size).toBe(1)
        expect(info.keys).toContain('test-key')
      })
    })

    describe('getReadStats', () => {
      it('should return read statistics', () => {
        const stats = service.getReadStats()

        expect(stats).toHaveProperty('totalReads')
        expect(stats).toHaveProperty('cacheHits')
        expect(stats).toHaveProperty('cacheMisses')
        expect(stats).toHaveProperty('averageReadTime')
        expect(stats).toHaveProperty('totalBytesRead')
      })
    })
  })
})
