/**
 * Jest 测试设置文件
 * 在所有测试运行前执行的全局设置
 */

import { ConfigService } from '@nestjs/config'

// 设置测试环境变量
process.env.NODE_ENV = 'test'
process.env.PORT = '3002'
process.env.UPLOAD_DIR = 'test-uploads'
process.env.TEMP_DIR = 'test-temp'
process.env.JWT_SECRET = 'test-jwt-secret'
process.env.API_KEY = 'test-api-key'
process.env.REDIS_HOST = ''
process.env.REDIS_PORT = ''
process.env.DATABASE_URL = 'sqlite::memory:'

// 全局测试超时设置
jest.setTimeout(30000)

// Mock 外部服务
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    disconnect: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  }))
})

// Mock Sharp 图片处理库
jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-image-data')),
    toFile: jest.fn().mockResolvedValue({ size: 1024 }),
    metadata: jest.fn().mockResolvedValue({
      width: 100,
      height: 100,
      format: 'jpeg',
      size: 1024,
    }),
  }))
})

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn(),
}))

// Mock 阿里云 OSS
jest.mock('ali-oss', () => {
  return jest.fn().mockImplementation(() => ({
    put: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
    head: jest.fn(),
    list: jest.fn(),
  }))
})

// Mock 腾讯云 COS
jest.mock('cos-nodejs-sdk-v5', () => {
  return jest.fn().mockImplementation(() => ({
    putObject: jest.fn(),
    getObject: jest.fn(),
    deleteObject: jest.fn(),
    headObject: jest.fn(),
    getBucket: jest.fn(),
  }))
})

// Mock 文件系统操作
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    ...jest.requireActual('fs').promises,
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue(Buffer.from('mock-file-content')),
    unlink: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({
      size: 1024,
      isFile: () => true,
      isDirectory: () => false,
      mtime: new Date(),
    }),
    access: jest.fn().mockResolvedValue(undefined),
    readdir: jest.fn().mockResolvedValue([]),
  },
}))

// 全局测试工具函数
global.createMockFile = (overrides = {}) => ({
  fieldname: 'file',
  originalname: 'test.jpg',
  encoding: '7bit',
  mimetype: 'image/jpeg',
  size: 1024,
  buffer: Buffer.from('mock-file-content'),
  ...overrides,
})

global.createMockFileInfo = (overrides = {}) => ({
  id: 'test-file-id',
  filename: 'test.jpg',
  originalName: 'test.jpg',
  mimeType: 'image/jpeg',
  size: 1024,
  category: 'images',
  accessLevel: 'public',
  uploadedAt: new Date(),
  path: '/uploads/images/test.jpg',
  url: 'http://localhost:3001/uploads/images/test.jpg',
  ...overrides,
})

// 清理函数
afterEach(() => {
  jest.clearAllMocks()
})

// 全局错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})
