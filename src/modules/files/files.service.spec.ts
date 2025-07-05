import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { FilesService } from './files.service'
import { FileValidationService } from './file-validation.service'
import { FileStorageService } from './file-storage.service'
import { CacheService } from '../cache/cache.service'
import { ErrorRecoveryService } from '../../common/services/error-recovery.service'
import { FileCategory, FileAccessLevel, FileReadMode } from '../../types/file.types'
import { FileUploadDto, FileUpdateDto, FileBatchOperationDto } from '../../dto'

describe('FilesService', () => {
  let service: FilesService
  let validationService: jest.Mocked<FileValidationService>
  let storageService: jest.Mocked<FileStorageService>
  let cacheService: jest.Mocked<CacheService>
  let configService: jest.Mocked<ConfigService>

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    destination: '/tmp',
    filename: 'test.jpg',
    path: '/tmp/test.jpg',
    buffer: Buffer.from('mock-file-content'),
    stream: null,
  }

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
    uploadedBy: undefined,
    uploadedAt: new Date(),
    metadata: undefined,
    checksum: 'abc123',
  }

  beforeEach(async () => {
    const mockValidationService = {
      validateFile: jest.fn(),
      calculateChecksum: jest.fn(),
      validateFileName: jest.fn(),
    }

    const mockStorageService = {
      storeFile: jest.fn(),
      getFileInfo: jest.fn(),
      updateFileInfo: jest.fn(),
      deleteFile: jest.fn(),
      searchFiles: jest.fn(),
      batchOperation: jest.fn(),
      readFileContent: jest.fn(),
      readFileChunks: jest.fn(),
      getReadStats: jest.fn(),
      clearContentCache: jest.fn(),
    }

    const mockCacheService = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    }

    const mockConfigService = {
      get: jest.fn(),
    }

    const mockErrorRecoveryService = {
      executeRecovery: jest.fn(),
      addRecoveryPlan: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: FileValidationService, useValue: mockValidationService },
        { provide: FileStorageService, useValue: mockStorageService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ErrorRecoveryService, useValue: mockErrorRecoveryService },
      ],
    }).compile()

    service = module.get<FilesService>(FilesService)
    validationService = module.get(FileValidationService)
    storageService = module.get(FileStorageService)
    cacheService = module.get(CacheService)
    configService = module.get(ConfigService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('uploadFile', () => {
    const uploadDto: FileUploadDto = {
      category: FileCategory.IMAGE,
      accessLevel: FileAccessLevel.PUBLIC,
    }

    it('should throw BadRequestException when no file provided', async () => {
      await expect(service.uploadFile(null, uploadDto)).rejects.toThrow(
        new BadRequestException('请选择要上传的文件')
      )
    })

    it('should throw BadRequestException when file validation fails', async () => {
      validationService.validateFile.mockResolvedValue({
        category: FileCategory.IMAGE,
        config: null,
        isValid: false,
        errors: ['文件类型不支持'],
      })

      // Mock fs.unlink for cleanup
      jest.spyOn(require('fs').promises, 'unlink').mockResolvedValue(undefined)

      await expect(service.uploadFile(mockFile, uploadDto)).rejects.toThrow(
        new BadRequestException('文件验证失败: 文件类型不支持')
      )
    })

    it('should successfully upload a valid file', async () => {
      validationService.validateFile.mockResolvedValue({
        category: FileCategory.IMAGE,
        config: { category: FileCategory.IMAGE } as any,
        isValid: true,
        errors: [],
      })

      validationService.calculateChecksum.mockResolvedValue('abc123')
      storageService.storeFile.mockResolvedValue(mockFileInfo)

      const result = await service.uploadFile(mockFile, uploadDto)

      expect(result).toEqual({
        id: mockFileInfo.id,
        originalName: mockFileInfo.originalName,
        filename: mockFileInfo.filename,
        path: mockFileInfo.path,
        url: mockFileInfo.url,
        category: mockFileInfo.category,
        accessLevel: mockFileInfo.accessLevel,
        size: mockFileInfo.size,
        mimeType: mockFileInfo.mimeType,
        uploadedBy: mockFileInfo.uploadedBy,
        uploadedAt: mockFileInfo.uploadedAt,
        metadata: mockFileInfo.metadata,
        checksum: mockFileInfo.checksum,
      })

      expect(validationService.validateFile).toHaveBeenCalledWith(mockFile)
      expect(validationService.calculateChecksum).toHaveBeenCalledWith(mockFile.path)
      expect(storageService.storeFile).toHaveBeenCalled()
    })

    it('should handle metadata parsing', async () => {
      const uploadDtoWithMetadata = {
        ...uploadDto,
        metadata: '{"key": "value"}',
      }

      validationService.validateFile.mockResolvedValue({
        category: FileCategory.IMAGE,
        config: { category: FileCategory.IMAGE } as any,
        isValid: true,
        errors: [],
      })

      validationService.calculateChecksum.mockResolvedValue('abc123')
      storageService.storeFile.mockResolvedValue(mockFileInfo)

      await service.uploadFile(mockFile, uploadDtoWithMetadata)

      expect(storageService.storeFile).toHaveBeenCalledWith(
        mockFile.path,
        mockFile.originalname,
        FileCategory.IMAGE,
        expect.objectContaining({
          metadata: { key: 'value' },
        }),
        expect.any(Object)
      )
    })

    it('should throw BadRequestException for invalid metadata JSON', async () => {
      const uploadDtoWithInvalidMetadata = {
        ...uploadDto,
        metadata: 'invalid-json',
      }

      validationService.validateFile.mockResolvedValue({
        category: FileCategory.IMAGE,
        config: { category: FileCategory.IMAGE } as any,
        isValid: true,
        errors: [],
      })

      await expect(service.uploadFile(mockFile, uploadDtoWithInvalidMetadata)).rejects.toThrow(
        new BadRequestException('元数据格式无效，必须是有效的JSON字符串')
      )
    })
  })

  describe('uploadMultipleFiles', () => {
    const uploadDto: FileUploadDto = {
      category: FileCategory.IMAGE,
      accessLevel: FileAccessLevel.PUBLIC,
    }

    it('should throw BadRequestException when no files provided', async () => {
      await expect(service.uploadMultipleFiles([], uploadDto)).rejects.toThrow(
        new BadRequestException('请选择要上传的文件')
      )

      await expect(service.uploadMultipleFiles(null, uploadDto)).rejects.toThrow(
        new BadRequestException('请选择要上传的文件')
      )
    })

    it('should upload multiple files successfully', async () => {
      const files = [mockFile, { ...mockFile, originalname: 'test2.jpg' }]

      validationService.validateFile.mockResolvedValue({
        category: FileCategory.IMAGE,
        config: { category: FileCategory.IMAGE } as any,
        isValid: true,
        errors: [],
      })

      validationService.calculateChecksum.mockResolvedValue('abc123')
      storageService.storeFile.mockResolvedValue(mockFileInfo)

      const results = await service.uploadMultipleFiles(files, uploadDto)

      expect(results).toHaveLength(2)
      expect(storageService.storeFile).toHaveBeenCalledTimes(2)
    })

    it('should handle partial failures', async () => {
      const files = [mockFile, { ...mockFile, originalname: 'test2.jpg' }]

      validationService.validateFile
        .mockResolvedValueOnce({
          category: FileCategory.IMAGE,
          config: { category: FileCategory.IMAGE } as any,
          isValid: true,
          errors: [],
        })
        .mockResolvedValueOnce({
          category: FileCategory.IMAGE,
          config: null,
          isValid: false,
          errors: ['文件类型不支持'],
        })

      validationService.calculateChecksum.mockResolvedValue('abc123')
      storageService.storeFile.mockResolvedValue(mockFileInfo)

      // Mock fs.unlink for cleanup
      jest.spyOn(require('fs').promises, 'unlink').mockResolvedValue(undefined)

      const results = await service.uploadMultipleFiles(files, uploadDto)

      expect(results).toHaveLength(1)
      expect(storageService.storeFile).toHaveBeenCalledTimes(1)
    })
  })

  describe('getFileById', () => {
    it('should return file info when file exists', async () => {
      storageService.getFileInfo.mockResolvedValue(mockFileInfo)

      const result = await service.getFileById('test-file-id')

      expect(result).toEqual({
        id: mockFileInfo.id,
        originalName: mockFileInfo.originalName,
        filename: mockFileInfo.filename,
        path: mockFileInfo.path,
        url: mockFileInfo.url,
        category: mockFileInfo.category,
        accessLevel: mockFileInfo.accessLevel,
        size: mockFileInfo.size,
        mimeType: mockFileInfo.mimeType,
        uploadedBy: mockFileInfo.uploadedBy,
        uploadedAt: mockFileInfo.uploadedAt,
        metadata: mockFileInfo.metadata,
        checksum: mockFileInfo.checksum,
      })

      expect(storageService.getFileInfo).toHaveBeenCalledWith('test-file-id')
    })

    it('should throw NotFoundException when file does not exist', async () => {
      storageService.getFileInfo.mockResolvedValue(null)

      await expect(service.getFileById('non-existent-id')).rejects.toThrow(
        '文件不存在: non-existent-id'
      )
    })
  })

  describe('updateFile', () => {
    const updateDto: FileUpdateDto = {
      filename: 'new-name.jpg',
      accessLevel: FileAccessLevel.PRIVATE,
      metadata: '{"updated": true}',
    }

    it('should update file successfully', async () => {
      validationService.validateFileName.mockReturnValue({
        isValid: true,
        errors: [],
      })

      storageService.updateFileInfo.mockResolvedValue({
        ...mockFileInfo,
        filename: 'new-name.jpg',
        accessLevel: FileAccessLevel.PRIVATE,
      })

      const result = await service.updateFile('test-file-id', updateDto)

      expect(result.filename).toBe('new-name.jpg')
      expect(result.accessLevel).toBe(FileAccessLevel.PRIVATE)
      expect(storageService.updateFileInfo).toHaveBeenCalledWith('test-file-id', {
        filename: 'new-name.jpg',
        accessLevel: FileAccessLevel.PRIVATE,
        metadata: { updated: true },
      })
    })

    it('should throw BadRequestException for invalid filename', async () => {
      validationService.validateFileName.mockReturnValue({
        isValid: false,
        errors: ['文件名包含非法字符'],
      })

      await expect(service.updateFile('test-file-id', updateDto)).rejects.toThrow(
        new BadRequestException('文件名无效: 文件名包含非法字符')
      )
    })

    it('should throw BadRequestException for invalid metadata JSON', async () => {
      const invalidUpdateDto = {
        ...updateDto,
        metadata: 'invalid-json',
      }

      validationService.validateFileName.mockReturnValue({
        isValid: true,
        errors: [],
      })

      await expect(service.updateFile('test-file-id', invalidUpdateDto)).rejects.toThrow(
        new BadRequestException('元数据格式无效，必须是有效的JSON字符串')
      )
    })
  })

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      storageService.deleteFile.mockResolvedValue(undefined)

      await service.deleteFile('test-file-id')

      expect(storageService.deleteFile).toHaveBeenCalledWith('test-file-id')
    })
  })

  describe('batchOperation', () => {
    it('should perform batch operation successfully', async () => {
      const batchDto: FileBatchOperationDto = {
        action: 'delete',
        fileIds: ['id1', 'id2'],
      }

      const expectedResult = { success: 2, failed: 0, errors: [], processed: 2 }
      storageService.batchOperation.mockResolvedValue(expectedResult)

      const result = await service.batchOperation(batchDto)

      expect(result).toEqual(expectedResult)
      expect(storageService.batchOperation).toHaveBeenCalledWith({
        action: 'delete',
        fileIds: ['id1', 'id2'],
        targetCategory: undefined,
        targetAccessLevel: undefined,
      })
    })
  })

  describe('File Content Reading', () => {
    describe('readFileContent', () => {
      it('should read file content successfully', async () => {
        const mockResult = {
          content: 'Hello, World!',
          size: 13,
          mimeType: 'text/plain',
          encoding: 'utf8' as BufferEncoding,
          fromCache: false,
          readTime: 10,
        }

        storageService.readFileContent.mockResolvedValue(mockResult)

        const result = await service.readFileContent('test-id', {
          mode: FileReadMode.FULL,
          encoding: 'utf8',
        })

        expect(result).toEqual(mockResult)
        expect(storageService.readFileContent).toHaveBeenCalledWith('test-id', {
          mode: FileReadMode.FULL,
          encoding: 'utf8',
        })
      })

      it('should handle file not found error', async () => {
        storageService.readFileContent.mockRejectedValue(new Error('文件不存在'))

        await expect(service.readFileContent('non-existent-id')).rejects.toThrow('文件不存在')
      })
    })

    describe('readTextFile', () => {
      it('should read text file content', async () => {
        const mockResult = {
          content: 'Hello, World!',
          size: 13,
          mimeType: 'text/plain',
          encoding: 'utf8' as BufferEncoding,
          fromCache: false,
          readTime: 10,
        }

        storageService.readFileContent.mockResolvedValue(mockResult)

        const result = await service.readTextFile('test-id', 'utf8')

        expect(result).toBe('Hello, World!')
        expect(storageService.readFileContent).toHaveBeenCalledWith('test-id', {
          encoding: 'utf8',
        })
      })

      it('should throw error for non-text content', async () => {
        const mockResult = {
          content: Buffer.from('binary data'),
          size: 11,
          mimeType: 'application/octet-stream',
          fromCache: false,
          readTime: 10,
        }

        storageService.readFileContent.mockResolvedValue(mockResult)

        await expect(service.readTextFile('test-id')).rejects.toThrow('文件内容不是文本格式')
      })
    })

    describe('readJsonFile', () => {
      it('should read and parse JSON file', async () => {
        const jsonData = { name: 'test', value: 123 }
        const mockResult = {
          content: JSON.stringify(jsonData),
          size: 25,
          mimeType: 'application/json',
          encoding: 'utf8' as BufferEncoding,
          fromCache: false,
          readTime: 10,
        }

        storageService.readFileContent.mockResolvedValue(mockResult)

        const result = await service.readJsonFile('test-id')

        expect(result).toEqual(jsonData)
      })

      it('should throw error for invalid JSON', async () => {
        const mockResult = {
          content: 'invalid json {',
          size: 14,
          mimeType: 'application/json',
          encoding: 'utf8' as BufferEncoding,
          fromCache: false,
          readTime: 10,
        }

        storageService.readFileContent.mockResolvedValue(mockResult)

        await expect(service.readJsonFile('test-id')).rejects.toThrow('JSON文件解析失败')
      })
    })

    describe('readFileChunks', () => {
      it('should read file in chunks', async () => {
        const mockChunks = [
          {
            chunk: 'Hello',
            chunkIndex: 0,
            totalChunks: 3,
            isLast: false,
            size: 5,
            offset: 0,
          },
          {
            chunk: ', Wor',
            chunkIndex: 1,
            totalChunks: 3,
            isLast: false,
            size: 5,
            offset: 5,
          },
          {
            chunk: 'ld!',
            chunkIndex: 2,
            totalChunks: 3,
            isLast: true,
            size: 3,
            offset: 10,
          },
        ]

        storageService.readFileChunks.mockImplementation(async function* () {
          for (const chunk of mockChunks) {
            yield chunk
          }
        })

        const chunks = []
        for await (const chunk of service.readFileChunks('test-id', { chunkSize: 5 })) {
          chunks.push(chunk)
        }

        expect(chunks).toEqual(mockChunks)
      })
    })

    describe('getFileReadStats', () => {
      it('should return read statistics', () => {
        const mockStats = {
          totalReads: 10,
          cacheHits: 3,
          cacheMisses: 7,
          averageReadTime: 15.5,
          totalBytesRead: 1024,
        }

        storageService.getReadStats.mockReturnValue(mockStats)

        const result = service.getFileReadStats()

        expect(result).toEqual(mockStats)
        expect(storageService.getReadStats).toHaveBeenCalled()
      })
    })

    describe('clearFileContentCache', () => {
      it('should clear content cache', () => {
        service.clearFileContentCache()

        expect(storageService.clearContentCache).toHaveBeenCalled()
      })
    })
  })
})
