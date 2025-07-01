import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { BadRequestException } from '@nestjs/common'
import { ImageProcessingService } from './image-processing.service'
import {
  ImageProcessingOptions,
  ThumbnailOptions,
  ProcessingResult,
  ImageInfo,
} from './interfaces/image-processing.interface'
import * as sharp from 'sharp'
import * as fs from 'fs'

// Mock Sharp
jest.mock('sharp')
const mockSharp = sharp as jest.MockedFunction<typeof sharp>

// Mock fs
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    stat: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
  },
}))

describe('ImageProcessingService', () => {
  let service: ImageProcessingService
  let configService: jest.Mocked<ConfigService>

  const mockSharpInstance = {
    metadata: jest.fn(),
    resize: jest.fn(),
    rotate: jest.fn(),
    extract: jest.fn(),
    jpeg: jest.fn(),
    png: jest.fn(),
    webp: jest.fn(),
    avif: jest.fn(),
    blur: jest.fn(),
    sharpen: jest.fn(),
    modulate: jest.fn(),
    gamma: jest.fn(),
    negate: jest.fn(),
    grayscale: jest.fn(),
    tint: jest.fn(),
    withMetadata: jest.fn(),
    toBuffer: jest.fn(),
    toFile: jest.fn(),
  }

  const mockImageMetadata = {
    width: 800,
    height: 600,
    format: 'jpeg' as const,
    density: 72,
    hasAlpha: false,
    channels: 3,
    space: 'srgb' as const,
  }

  const mockProcessedBuffer = Buffer.from('processed-image-data')

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImageProcessingService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile()

    service = module.get<ImageProcessingService>(ImageProcessingService)
    configService = module.get(ConfigService)

    // Reset all mocks
    jest.clearAllMocks()

    // Setup Sharp mock chain
    Object.keys(mockSharpInstance).forEach(method => {
      mockSharpInstance[method].mockReturnThis()
    })

    mockSharpInstance.metadata.mockResolvedValue(mockImageMetadata)
    mockSharpInstance.toBuffer.mockResolvedValue(mockProcessedBuffer)
    mockSharp.mockReturnValue(mockSharpInstance as any)

    // Setup fs mocks
    ;(fs.promises.access as jest.Mock).mockResolvedValue(undefined)
    ;(fs.promises.stat as jest.Mock).mockResolvedValue({ size: 2048 })
    ;(fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined)
    ;(fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined)
  })

  describe('processImage', () => {
    const inputPath = '/test/input.jpg'
    const outputPath = '/test/output.jpg'

    it('should process image successfully with default options', async () => {
      const result = await service.processImage(inputPath, outputPath)

      expect(result).toEqual({
        buffer: mockProcessedBuffer,
        info: {
          width: mockImageMetadata.width,
          height: mockImageMetadata.height,
          format: mockImageMetadata.format,
          size: mockProcessedBuffer.length,
          density: mockImageMetadata.density,
          hasAlpha: mockImageMetadata.hasAlpha,
          channels: mockImageMetadata.channels,
          colorspace: mockImageMetadata.space,
        },
        originalSize: 2048,
        processedSize: mockProcessedBuffer.length,
        compressionRatio: expect.any(Number),
      })

      expect(mockSharp).toHaveBeenCalledWith(inputPath)
      expect(fs.promises.writeFile).toHaveBeenCalledWith(outputPath, mockProcessedBuffer)
    })

    it('should apply resize options', async () => {
      const options: ImageProcessingOptions = {
        resize: {
          width: 400,
          height: 300,
          fit: 'cover',
        },
      }

      await service.processImage(inputPath, outputPath, options)

      expect(mockSharpInstance.resize).toHaveBeenCalledWith(400, 300, {
        fit: 'cover',
        position: undefined,
        background: undefined,
        withoutEnlargement: undefined,
        withoutReduction: undefined,
      })
    })

    it('should apply compression options', async () => {
      const options: ImageProcessingOptions = {
        compress: {
          quality: 70,
          progressive: true,
        },
      }

      await service.processImage(inputPath, outputPath, options)

      expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({
        quality: 70,
        progressive: true,
        mozjpeg: undefined,
        optimizeScans: undefined,
        optimizeCoding: undefined,
        quantizationTable: undefined,
      })
    })

    it('should apply crop options', async () => {
      const options: ImageProcessingOptions = {
        crop: {
          left: 100,
          top: 50,
          width: 200,
          height: 150,
        },
      }

      await service.processImage(inputPath, outputPath, options)

      expect(mockSharpInstance.extract).toHaveBeenCalledWith({
        left: 100,
        top: 50,
        width: 200,
        height: 150,
      })
    })

    it('should apply rotation options', async () => {
      const options: ImageProcessingOptions = {
        rotate: {
          angle: 90,
          background: 'white',
        },
      }

      await service.processImage(inputPath, outputPath, options)

      expect(mockSharpInstance.rotate).toHaveBeenCalledWith(90, {
        background: 'white',
      })
    })

    it('should apply format conversion', async () => {
      const options: ImageProcessingOptions = {
        format: {
          format: 'webp',
          quality: 85,
        },
      }

      await service.processImage(inputPath, outputPath, options)

      expect(mockSharpInstance.webp).toHaveBeenCalledWith({
        quality: 85,
        progressive: undefined,
        lossless: undefined,
        effort: undefined,
      })
    })

    it('should strip metadata when requested', async () => {
      const options: ImageProcessingOptions = {
        stripMetadata: true,
      }

      await service.processImage(inputPath, outputPath, options)

      expect(mockSharpInstance.withMetadata).toHaveBeenCalledWith({})
    })

    it('should throw BadRequestException for unsupported format', async () => {
      mockSharpInstance.metadata.mockResolvedValue({
        ...mockImageMetadata,
        format: 'unsupported' as any,
      })

      await expect(service.processImage(inputPath, outputPath)).rejects.toThrow(
        BadRequestException
      )
    })

    it('should throw BadRequestException for invalid file', async () => {
      ;(fs.promises.access as jest.Mock).mockRejectedValue(new Error('File not found'))

      await expect(service.processImage(inputPath, outputPath)).rejects.toThrow(
        BadRequestException
      )
    })
  })

  describe('generateThumbnails', () => {
    const inputPath = '/test/input.jpg'
    const outputDir = '/test/thumbnails'

    it('should generate thumbnails successfully', async () => {
      const options: ThumbnailOptions = {
        sizes: [
          { name: 'small', width: 150, height: 150, quality: 80 },
          { name: 'medium', width: 300, height: 300, quality: 85 },
        ],
        format: 'jpeg',
        progressive: true,
      }

      const result = await service.generateThumbnails(inputPath, outputDir, options)

      expect(result.thumbnails).toHaveLength(2)
      expect(result.thumbnails[0]).toEqual({
        name: 'small',
        buffer: mockProcessedBuffer,
        width: mockImageMetadata.width,
        height: mockImageMetadata.height,
        size: mockProcessedBuffer.length,
      })

      expect(mockSharpInstance.resize).toHaveBeenCalledWith(150, 150, {
        fit: 'cover',
        position: 'center',
      })
      expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({
        quality: 80,
        progressive: true,
      })
    })

    it('should generate WebP thumbnails', async () => {
      const options: ThumbnailOptions = {
        sizes: [{ name: 'small', width: 150, quality: 80 }],
        format: 'webp',
      }

      await service.generateThumbnails(inputPath, outputDir, options)

      expect(mockSharpInstance.webp).toHaveBeenCalledWith({
        quality: 80,
      })
    })

    it('should generate PNG thumbnails', async () => {
      const options: ThumbnailOptions = {
        sizes: [{ name: 'small', width: 150, quality: 80 }],
        format: 'png',
        progressive: true,
      }

      await service.generateThumbnails(inputPath, outputDir, options)

      expect(mockSharpInstance.png).toHaveBeenCalledWith({
        quality: 80,
        progressive: true,
      })
    })
  })

  describe('getImageInfo', () => {
    it('should return image information', async () => {
      const imagePath = '/test/image.jpg'

      const result = await service.getImageInfo(imagePath)

      expect(result).toEqual({
        width: mockImageMetadata.width,
        height: mockImageMetadata.height,
        format: mockImageMetadata.format,
        size: 2048,
        density: mockImageMetadata.density,
        hasAlpha: mockImageMetadata.hasAlpha,
        channels: mockImageMetadata.channels,
        colorspace: mockImageMetadata.space,
      })

      expect(mockSharp).toHaveBeenCalledWith(imagePath)
      expect(mockSharpInstance.metadata).toHaveBeenCalled()
      expect(fs.promises.stat).toHaveBeenCalledWith(imagePath)
    })
  })

  describe('compressImage', () => {
    it('should compress image with specified quality', async () => {
      const inputPath = '/test/input.jpg'
      const outputPath = '/test/output.jpg'
      const quality = 70

      const result = await service.compressImage(inputPath, outputPath, quality)

      expect(result).toBeDefined()
      expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({
        quality: 70,
        progressive: undefined,
        mozjpeg: undefined,
        optimizeScans: undefined,
        optimizeCoding: undefined,
        quantizationTable: undefined,
      })
      expect(mockSharpInstance.withMetadata).toHaveBeenCalledWith({})
    })
  })

  describe('resizeImage', () => {
    it('should resize image with width only', async () => {
      const inputPath = '/test/input.jpg'
      const outputPath = '/test/output.jpg'
      const width = 400

      const result = await service.resizeImage(inputPath, outputPath, width)

      expect(result).toBeDefined()
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(400, undefined, {
        fit: 'inside',
        position: undefined,
        background: undefined,
        withoutEnlargement: undefined,
        withoutReduction: undefined,
      })
    })

    it('should resize image with width and height', async () => {
      const inputPath = '/test/input.jpg'
      const outputPath = '/test/output.jpg'
      const width = 400
      const height = 300

      const result = await service.resizeImage(inputPath, outputPath, width, height)

      expect(result).toBeDefined()
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(400, 300, {
        fit: 'inside',
        position: undefined,
        background: undefined,
        withoutEnlargement: undefined,
        withoutReduction: undefined,
      })
    })
  })

  describe('convertFormat', () => {
    it('should convert image to WebP format', async () => {
      const inputPath = '/test/input.jpg'
      const outputPath = '/test/output.webp'
      const format = 'webp'
      const quality = 85

      const result = await service.convertFormat(inputPath, outputPath, format, quality)

      expect(result).toBeDefined()
      expect(mockSharpInstance.webp).toHaveBeenCalledWith({
        quality: 85,
        progressive: undefined,
        lossless: undefined,
        effort: undefined,
      })
    })

    it('should convert image to PNG format', async () => {
      const inputPath = '/test/input.jpg'
      const outputPath = '/test/output.png'
      const format = 'png'
      const quality = 90

      const result = await service.convertFormat(inputPath, outputPath, format, quality)

      expect(result).toBeDefined()
      expect(mockSharpInstance.png).toHaveBeenCalledWith({
        quality: 90,
        progressive: undefined,
        lossless: undefined,
        effort: undefined,
      })
    })
  })
})
