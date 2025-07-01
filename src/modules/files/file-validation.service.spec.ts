import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { BadRequestException } from '@nestjs/common'
import { FileValidationService } from './file-validation.service'
import { FileCategory } from '../../types/file.types'
import * as fs from 'fs'

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}))

// Mock file-type module
jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
}))

describe('FileValidationService', () => {
  let service: FileValidationService
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

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileValidationService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile()

    service = module.get<FileValidationService>(FileValidationService)
    configService = module.get(ConfigService)

    // Setup default config values
    configService.get.mockImplementation((key: string) => {
      const config = {
        MAX_IMAGE_SIZE: '10485760', // 10MB
        MAX_SCRIPT_SIZE: '1048576', // 1MB
        MAX_STYLE_SIZE: '1048576', // 1MB
        MAX_FONT_SIZE: '5242880', // 5MB
        MAX_DOCUMENT_SIZE: '52428800', // 50MB
        MAX_MUSIC_SIZE: '104857600', // 100MB
      }
      return config[key]
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('validateFile', () => {
    it('should validate a valid JPEG image file', async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]) // JPEG signature
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(jpegBuffer)

      const { fileTypeFromBuffer } = require('file-type')
      fileTypeFromBuffer.mockResolvedValue({ mime: 'image/jpeg', ext: 'jpg' })

      const result = await service.validateFile(mockFile)

      expect(result.isValid).toBe(true)
      expect(result.category).toBe(FileCategory.IMAGE)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject unsupported file type', async () => {
      const unsupportedFile = {
        ...mockFile,
        originalname: 'test.xyz',
        mimetype: 'application/unknown',
      }

      const result = await service.validateFile(unsupportedFile)

      expect(result.isValid).toBe(false)
      expect(result.category).toBe(FileCategory.TEMP)
      expect(result.errors).toContain('不支持的文件类型: .xyz')
    })

    it('should reject file with mismatched MIME type', async () => {
      const mismatchedFile = {
        ...mockFile,
        originalname: 'test.jpg',
        mimetype: 'text/plain', // Wrong MIME type for JPEG
      }

      const result = await service.validateFile(mismatchedFile)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('MIME类型 text/plain 不匹配文件扩展名 .jpg')
    })

    it('should reject oversized file', async () => {
      const oversizedFile = {
        ...mockFile,
        size: 20 * 1024 * 1024, // 20MB, exceeds 10MB limit for images
      }

      const result = await service.validateFile(oversizedFile)

      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('文件大小'))).toBe(true)
    })

    it('should validate PNG image file', async () => {
      const pngFile = {
        ...mockFile,
        originalname: 'test.png',
        mimetype: 'image/png',
      }

      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]) // PNG signature
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(pngBuffer)

      const { fileTypeFromBuffer } = require('file-type')
      fileTypeFromBuffer.mockResolvedValue({ mime: 'image/png', ext: 'png' })

      const result = await service.validateFile(pngFile)

      expect(result.isValid).toBe(true)
      expect(result.category).toBe(FileCategory.IMAGE)
    })

    it('should validate SVG file', async () => {
      const svgFile = {
        ...mockFile,
        originalname: 'test.svg',
        mimetype: 'image/svg+xml',
      }

      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">')
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(svgBuffer)

      const { fileTypeFromBuffer } = require('file-type')
      fileTypeFromBuffer.mockResolvedValue(null) // SVG might not be detected by file-type

      const result = await service.validateFile(svgFile)

      expect(result.isValid).toBe(true)
      expect(result.category).toBe(FileCategory.IMAGE)
    })

    it('should validate JavaScript file', async () => {
      const jsFile = {
        ...mockFile,
        originalname: 'script.js',
        mimetype: 'application/javascript',
      }

      const jsBuffer = Buffer.from('console.log("Hello World");')
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(jsBuffer)

      const { fileTypeFromBuffer } = require('file-type')
      fileTypeFromBuffer.mockResolvedValue(null)

      const result = await service.validateFile(jsFile)

      expect(result.isValid).toBe(true)
      expect(result.category).toBe(FileCategory.SCRIPT)
    })

    it('should reject JavaScript file with malicious code', async () => {
      const maliciousJsFile = {
        ...mockFile,
        originalname: 'malicious.js',
        mimetype: 'application/javascript',
      }

      const maliciousBuffer = Buffer.from('eval("malicious code");')
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(maliciousBuffer)

      const { fileTypeFromBuffer } = require('file-type')
      fileTypeFromBuffer.mockResolvedValue(null)

      const result = await service.validateFile(maliciousJsFile)

      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('恶意代码模式'))).toBe(true)
    })

    it('should validate JSON file', async () => {
      const jsonFile = {
        ...mockFile,
        originalname: 'data.json',
        mimetype: 'application/json',
      }

      const jsonBuffer = Buffer.from('{"key": "value"}')
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(jsonBuffer)

      const { fileTypeFromBuffer } = require('file-type')
      fileTypeFromBuffer.mockResolvedValue(null)

      const result = await service.validateFile(jsonFile)

      expect(result.isValid).toBe(true)
      expect(result.category).toBe(FileCategory.SCRIPT)
    })

    it('should reject invalid JSON file', async () => {
      const invalidJsonFile = {
        ...mockFile,
        originalname: 'invalid.json',
        mimetype: 'application/json',
      }

      const invalidJsonBuffer = Buffer.from('{"key": invalid}')
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(invalidJsonBuffer)

      const { fileTypeFromBuffer } = require('file-type')
      fileTypeFromBuffer.mockResolvedValue(null)

      const result = await service.validateFile(invalidJsonFile)

      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.includes('无效的JSON格式'))).toBe(true)
    })

    it('should validate PDF document', async () => {
      const pdfFile = {
        ...mockFile,
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
      }

      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46]) // %PDF signature
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(pdfBuffer)

      const { fileTypeFromBuffer } = require('file-type')
      fileTypeFromBuffer.mockResolvedValue({ mime: 'application/pdf', ext: 'pdf' })

      const result = await service.validateFile(pdfFile)

      expect(result.isValid).toBe(true)
      expect(result.category).toBe(FileCategory.DOCUMENT)
    })
  })

  describe('calculateChecksum', () => {
    it('should calculate SHA-256 checksum', async () => {
      const testBuffer = Buffer.from('test content')
      ;(fs.promises.readFile as jest.Mock).mockResolvedValue(testBuffer)

      const checksum = await service.calculateChecksum('/path/to/file')

      expect(checksum).toBeDefined()
      expect(typeof checksum).toBe('string')
      expect(checksum.length).toBe(64) // SHA-256 produces 64-character hex string
    })
  })

  describe('validateFileName', () => {
    it('should validate a normal filename', () => {
      const result = service.validateFileName('normal-file.jpg')

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject filename that is too long', () => {
      const longFilename = 'a'.repeat(256) + '.jpg'
      const result = service.validateFileName(longFilename)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('文件名长度不能超过255个字符')
    })

    it('should reject filename with illegal characters', () => {
      const illegalFilename = 'file<>:"/\\|?*.jpg'
      const result = service.validateFileName(illegalFilename)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('文件名包含非法字符')
    })

    it('should reject reserved system names', () => {
      const reservedNames = ['CON.jpg', 'PRN.txt', 'AUX.pdf', 'NUL.doc']

      reservedNames.forEach(filename => {
        const result = service.validateFileName(filename)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('文件名不能使用系统保留名称')
      })
    })
  })

  describe('validateCategoryLimits', () => {
    it('should pass validation when within limits', async () => {
      await expect(
        service.validateCategoryLimits(FileCategory.IMAGE, 10, 1024 * 1024, 1024)
      ).resolves.not.toThrow()
    })

    it('should throw when file count exceeds limit', async () => {
      await expect(
        service.validateCategoryLimits(FileCategory.IMAGE, 1000, 1024, 1024)
      ).rejects.toThrow(BadRequestException)
    })

    it('should throw when total size exceeds limit', async () => {
      const largeSize = 1024 * 1024 * 1024 * 10 // 10GB
      await expect(
        service.validateCategoryLimits(FileCategory.IMAGE, 10, largeSize, 1024)
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('getFileTypeConfig', () => {
    it('should return config for valid extension', () => {
      const config = service.getFileTypeConfig('jpg')
      expect(config).toBeDefined()
      expect(config.category).toBe(FileCategory.IMAGE)
    })

    it('should return config for extension with dot', () => {
      const config = service.getFileTypeConfig('.jpg')
      expect(config).toBeDefined()
      expect(config.category).toBe(FileCategory.IMAGE)
    })

    it('should return null for unsupported extension', () => {
      const config = service.getFileTypeConfig('xyz')
      expect(config).toBeNull()
    })
  })
})
