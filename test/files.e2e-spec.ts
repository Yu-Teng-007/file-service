import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import * as request from 'supertest'
import { join } from 'path'
import { promises as fs } from 'fs'
import { AppModule } from '../src/app.module'
import { FileCategory, FileAccessLevel } from '../src/types/file.types'

describe('Files (e2e)', () => {
  let app: INestApplication
  let uploadDir: string

  beforeAll(async () => {
    // 设置测试环境变量
    process.env.NODE_ENV = 'test'
    process.env.UPLOAD_DIR = 'test-uploads'
    process.env.REDIS_HOST = ''
    process.env.DATABASE_URL = 'sqlite::memory:'

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    uploadDir = process.env.UPLOAD_DIR || 'test-uploads'

    // 创建测试目录
    await fs.mkdir(uploadDir, { recursive: true })
    await fs.mkdir(join(uploadDir, 'temp'), { recursive: true })
    await fs.mkdir(join(uploadDir, 'images'), { recursive: true })
    await fs.mkdir(join(uploadDir, 'scripts'), { recursive: true })
    await fs.mkdir(join(uploadDir, 'documents'), { recursive: true })
  })

  afterAll(async () => {
    // 清理测试文件
    try {
      await fs.rmdir(uploadDir, { recursive: true })
    } catch (error) {
      // 忽略清理错误
    }
    await app.close()
  })

  beforeEach(async () => {
    // 清理上传目录
    try {
      const files = await fs.readdir(join(uploadDir, 'images'))
      for (const file of files) {
        await fs.unlink(join(uploadDir, 'images', file))
      }
    } catch (error) {
      // 目录可能不存在，忽略错误
    }
  })

  describe('/api/files (POST)', () => {
    it('should upload a single image file', async () => {
      // 创建测试图片文件
      const testImageBuffer = Buffer.from([
        0xff,
        0xd8,
        0xff,
        0xe0, // JPEG signature
        ...Array(100).fill(0x00), // Dummy data
        0xff,
        0xd9, // JPEG end marker
      ])

      const response = await request(app.getHttpServer())
        .post('/api/files/upload')
        .attach('file', testImageBuffer, 'test.jpg')
        .field('category', FileCategory.IMAGE)
        .field('accessLevel', FileAccessLevel.PUBLIC)
        .expect(201)

      expect(response.body).toMatchObject({
        success: true,
        message: '文件上传成功',
        data: {
          id: expect.any(String),
          originalName: 'test.jpg',
          filename: expect.any(String),
          category: FileCategory.IMAGE,
          accessLevel: FileAccessLevel.PUBLIC,
          size: expect.any(Number),
          mimeType: 'image/jpeg',
          url: expect.stringContaining('/uploads/images/'),
          uploadedAt: expect.any(String),
        },
      })
    })

    it('should upload multiple files', async () => {
      const testImageBuffer1 = Buffer.from([
        0xff,
        0xd8,
        0xff,
        0xe0,
        ...Array(50).fill(0x00),
        0xff,
        0xd9,
      ])
      const testImageBuffer2 = Buffer.from([
        0xff,
        0xd8,
        0xff,
        0xe0,
        ...Array(60).fill(0x00),
        0xff,
        0xd9,
      ])

      const response = await request(app.getHttpServer())
        .post('/api/files/upload/multiple')
        .attach('files', testImageBuffer1, 'test1.jpg')
        .attach('files', testImageBuffer2, 'test2.jpg')
        .field('category', FileCategory.IMAGE)
        .field('accessLevel', FileAccessLevel.PUBLIC)
        .expect(201)

      expect(response.body).toMatchObject({
        success: true,
        message: '文件上传成功',
        data: expect.arrayContaining([
          expect.objectContaining({
            originalName: 'test1.jpg',
            category: FileCategory.IMAGE,
          }),
          expect.objectContaining({
            originalName: 'test2.jpg',
            category: FileCategory.IMAGE,
          }),
        ]),
      })

      expect(response.body.data).toHaveLength(2)
    })

    it('should reject unsupported file type', async () => {
      const testBuffer = Buffer.from('unsupported file content')

      const response = await request(app.getHttpServer())
        .post('/api/files/upload')
        .attach('file', testBuffer, 'test.xyz')
        .field('category', FileCategory.IMAGE)
        .expect(400)

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('文件验证失败'),
      })
    })

    it('should reject oversized file', async () => {
      // 创建一个超大的文件 (超过配置的限制)
      const largeBuffer = Buffer.alloc(20 * 1024 * 1024) // 20MB
      largeBuffer.fill(0xff)

      const response = await request(app.getHttpServer())
        .post('/api/files/upload')
        .attach('file', largeBuffer, 'large.jpg')
        .field('category', FileCategory.IMAGE)
        .expect(400)

      expect(response.body.success).toBe(false)
    })

    it('should upload with custom metadata', async () => {
      const testImageBuffer = Buffer.from([
        0xff,
        0xd8,
        0xff,
        0xe0,
        ...Array(100).fill(0x00),
        0xff,
        0xd9,
      ])
      const metadata = JSON.stringify({ author: 'test-user', tags: ['test', 'image'] })

      const response = await request(app.getHttpServer())
        .post('/api/files/upload')
        .attach('file', testImageBuffer, 'test-with-metadata.jpg')
        .field('category', FileCategory.IMAGE)
        .field('accessLevel', FileAccessLevel.PUBLIC)
        .field('metadata', metadata)
        .expect(201)

      expect(response.body.data.metadata).toEqual({
        author: 'test-user',
        tags: ['test', 'image'],
      })
    })
  })

  describe('/api/files (GET)', () => {
    let uploadedFileId: string

    beforeEach(async () => {
      // 上传一个测试文件
      const testImageBuffer = Buffer.from([
        0xff,
        0xd8,
        0xff,
        0xe0,
        ...Array(100).fill(0x00),
        0xff,
        0xd9,
      ])

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/files/upload')
        .attach('file', testImageBuffer, 'test-for-get.jpg')
        .field('category', FileCategory.IMAGE)
        .field('accessLevel', FileAccessLevel.PUBLIC)

      uploadedFileId = uploadResponse.body.data.id
    })

    it('should list files with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/files')
        .query({ page: 1, limit: 10 })
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        data: {
          files: expect.any(Array),
          total: expect.any(Number),
          page: 1,
          limit: 10,
          totalPages: expect.any(Number),
        },
      })

      expect(response.body.data.files.length).toBeGreaterThan(0)
    })

    it('should filter files by category', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/files')
        .query({ category: FileCategory.IMAGE })
        .expect(200)

      expect(response.body.data.files.every(file => file.category === FileCategory.IMAGE)).toBe(
        true
      )
    })

    it('should search files by filename', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/files')
        .query({ filename: 'test-for-get' })
        .expect(200)

      expect(response.body.data.files.some(file => file.filename.includes('test-for-get'))).toBe(
        true
      )
    })

    it('should get file by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/files/${uploadedFileId}`)
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: uploadedFileId,
          originalName: 'test-for-get.jpg',
          category: FileCategory.IMAGE,
          accessLevel: FileAccessLevel.PUBLIC,
        },
      })
    })

    it('should return 404 for non-existent file', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'

      const response = await request(app.getHttpServer())
        .get(`/api/files/${nonExistentId}`)
        .expect(404)

      expect(response.body.success).toBe(false)
    })
  })

  describe('/api/files/:id (PUT)', () => {
    let uploadedFileId: string

    beforeEach(async () => {
      const testImageBuffer = Buffer.from([
        0xff,
        0xd8,
        0xff,
        0xe0,
        ...Array(100).fill(0x00),
        0xff,
        0xd9,
      ])

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/files/upload')
        .attach('file', testImageBuffer, 'test-for-update.jpg')
        .field('category', FileCategory.IMAGE)
        .field('accessLevel', FileAccessLevel.PUBLIC)

      uploadedFileId = uploadResponse.body.data.id
    })

    it('should update file metadata', async () => {
      const updateData = {
        filename: 'updated-name.jpg',
        accessLevel: FileAccessLevel.PRIVATE,
        metadata: JSON.stringify({ updated: true }),
      }

      const response = await request(app.getHttpServer())
        .put(`/api/files/${uploadedFileId}`)
        .send(updateData)
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: uploadedFileId,
          filename: 'updated-name.jpg',
          accessLevel: FileAccessLevel.PRIVATE,
          metadata: { updated: true },
        },
      })
    })

    it('should reject invalid filename', async () => {
      const updateData = {
        filename: 'invalid<>filename.jpg',
      }

      const response = await request(app.getHttpServer())
        .put(`/api/files/${uploadedFileId}`)
        .send(updateData)
        .expect(400)

      expect(response.body.success).toBe(false)
    })
  })

  describe('/api/files/:id (DELETE)', () => {
    let uploadedFileId: string

    beforeEach(async () => {
      const testImageBuffer = Buffer.from([
        0xff,
        0xd8,
        0xff,
        0xe0,
        ...Array(100).fill(0x00),
        0xff,
        0xd9,
      ])

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/files/upload')
        .attach('file', testImageBuffer, 'test-for-delete.jpg')
        .field('category', FileCategory.IMAGE)
        .field('accessLevel', FileAccessLevel.PUBLIC)

      uploadedFileId = uploadResponse.body.data.id
    })

    it('should delete file successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/files/${uploadedFileId}`)
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        message: '文件删除成功',
      })

      // 验证文件已被删除
      await request(app.getHttpServer()).get(`/api/files/${uploadedFileId}`).expect(404)
    })
  })

  describe('/api/files/batch (POST)', () => {
    let fileIds: string[]

    beforeEach(async () => {
      fileIds = []
      const testImageBuffer = Buffer.from([
        0xff,
        0xd8,
        0xff,
        0xe0,
        ...Array(100).fill(0x00),
        0xff,
        0xd9,
      ])

      // 上传多个测试文件
      for (let i = 0; i < 3; i++) {
        const uploadResponse = await request(app.getHttpServer())
          .post('/api/files/upload')
          .attach('file', testImageBuffer, `batch-test-${i}.jpg`)
          .field('category', FileCategory.IMAGE)
          .field('accessLevel', FileAccessLevel.PUBLIC)

        fileIds.push(uploadResponse.body.data.id)
      }
    })

    it('should perform batch delete operation', async () => {
      const batchData = {
        action: 'delete',
        fileIds: fileIds.slice(0, 2), // 删除前两个文件
      }

      const response = await request(app.getHttpServer())
        .post('/api/files/batch')
        .send(batchData)
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        data: {
          success: true,
          processed: 2,
        },
      })

      // 验证文件已被删除
      for (const fileId of fileIds.slice(0, 2)) {
        await request(app.getHttpServer()).get(`/api/files/${fileId}`).expect(404)
      }

      // 验证第三个文件仍然存在
      await request(app.getHttpServer()).get(`/api/files/${fileIds[2]}`).expect(200)
    })

    it('should perform batch access level update', async () => {
      const batchData = {
        action: 'updateAccessLevel',
        fileIds: fileIds,
        targetAccessLevel: FileAccessLevel.PRIVATE,
      }

      const response = await request(app.getHttpServer())
        .post('/api/files/batch')
        .send(batchData)
        .expect(200)

      expect(response.body.data.processed).toBe(3)

      // 验证访问级别已更新
      for (const fileId of fileIds) {
        const fileResponse = await request(app.getHttpServer())
          .get(`/api/files/${fileId}`)
          .expect(200)

        expect(fileResponse.body.data.accessLevel).toBe(FileAccessLevel.PRIVATE)
      }
    })
  })

  describe('/api/files/stats (GET)', () => {
    it('should return file statistics', async () => {
      const response = await request(app.getHttpServer()).get('/api/files/stats').expect(200)

      expect(response.body).toMatchObject({
        success: true,
        data: {
          totalFiles: expect.any(Number),
          totalSize: expect.any(Number),
          categoryBreakdown: expect.any(Object),
          recentUploads: expect.any(Array),
        },
      })
    })
  })

  describe('File Content Reading (e2e)', () => {
    let uploadedFileId: string
    let textFileId: string
    let jsonFileId: string

    beforeEach(async () => {
      // Upload a test image file
      const testImageBuffer = Buffer.from([
        0xff,
        0xd8,
        0xff,
        0xe0,
        ...Array(100).fill(0x00),
        0xff,
        0xd9,
      ])
      const imageResponse = await request(app.getHttpServer())
        .post('/api/files/upload')
        .attach('file', testImageBuffer, 'test-image.jpg')
        .field('category', FileCategory.IMAGE)
        .field('accessLevel', FileAccessLevel.PUBLIC)

      uploadedFileId = imageResponse.body.data.id

      // Upload a test text file
      const testTextBuffer = Buffer.from('Hello, World!\nThis is a test file.')
      const textResponse = await request(app.getHttpServer())
        .post('/api/files/upload')
        .attach('file', testTextBuffer, 'test.txt')
        .field('category', FileCategory.DOCUMENT)
        .field('accessLevel', FileAccessLevel.PUBLIC)

      textFileId = textResponse.body.data.id

      // Upload a test JSON file
      const testJsonData = { name: 'test', value: 123, items: ['a', 'b', 'c'] }
      const testJsonBuffer = Buffer.from(JSON.stringify(testJsonData, null, 2))
      const jsonResponse = await request(app.getHttpServer())
        .post('/api/files/upload')
        .attach('file', testJsonBuffer, 'test.json')
        .field('category', FileCategory.SCRIPT)
        .field('accessLevel', FileAccessLevel.PUBLIC)

      jsonFileId = jsonResponse.body.data.id
    })

    describe('/api/files/:id/content (GET)', () => {
      it('should read file content as buffer', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/files/${uploadedFileId}/content`)
          .query({ mode: 'full', encoding: 'buffer' })
          .expect(200)

        expect(response.body).toMatchObject({
          success: true,
          message: '文件内容读取成功',
          data: {
            content: expect.any(String), // base64 encoded
            size: expect.any(Number),
            mimeType: 'image/jpeg',
            fromCache: expect.any(Boolean),
            readTime: expect.any(Number),
          },
        })
      })

      it('should read partial file content', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/files/${textFileId}/content`)
          .query({ mode: 'partial', encoding: 'utf8', start: 0, end: 12 })
          .expect(200)

        expect(response.body).toMatchObject({
          success: true,
          data: {
            content: 'Hello, World!',
            size: 13,
            encoding: 'utf8',
          },
        })
      })

      it('should return 404 for non-existent file', async () => {
        const nonExistentId = '00000000-0000-0000-0000-000000000000'

        await request(app.getHttpServer()).get(`/api/files/${nonExistentId}/content`).expect(404)
      })

      it('should validate parameters for partial read', async () => {
        await request(app.getHttpServer())
          .get(`/api/files/${textFileId}/content`)
          .query({ mode: 'partial' }) // missing start parameter
          .expect(400)
      })
    })

    describe('/api/files/:id/text (GET)', () => {
      it('should read text file content', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/files/${textFileId}/text`)
          .query({ encoding: 'utf8' })
          .expect(200)

        expect(response.body).toMatchObject({
          success: true,
          message: '文本内容读取成功',
          data: 'Hello, World!\nThis is a test file.',
        })
      })

      it('should handle different encodings', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/files/${textFileId}/text`)
          .query({ encoding: 'ascii' })
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(typeof response.body.data).toBe('string')
      })

      it('should return 400 for binary files', async () => {
        await request(app.getHttpServer()).get(`/api/files/${uploadedFileId}/text`).expect(400)
      })
    })

    describe('/api/files/:id/json (GET)', () => {
      it('should read and parse JSON file', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/files/${jsonFileId}/json`)
          .expect(200)

        expect(response.body).toMatchObject({
          success: true,
          message: 'JSON内容读取成功',
          data: {
            name: 'test',
            value: 123,
            items: ['a', 'b', 'c'],
          },
        })
      })

      it('should return 400 for invalid JSON', async () => {
        await request(app.getHttpServer()).get(`/api/files/${textFileId}/json`).expect(400)
      })
    })

    describe('/api/files/stats/read (GET)', () => {
      it('should return file read statistics', async () => {
        // Perform some reads first
        await request(app.getHttpServer()).get(`/api/files/${textFileId}/text`).expect(200)

        const response = await request(app.getHttpServer()).get('/api/files/stats/read').expect(200)

        expect(response.body).toMatchObject({
          success: true,
          message: '统计信息获取成功',
          data: {
            totalReads: expect.any(Number),
            cacheHits: expect.any(Number),
            cacheMisses: expect.any(Number),
            averageReadTime: expect.any(Number),
            totalBytesRead: expect.any(Number),
          },
        })
      })
    })

    describe('/api/files/cache/content (DELETE)', () => {
      it('should clear file content cache', async () => {
        const response = await request(app.getHttpServer())
          .delete('/api/files/cache/content')
          .expect(200)

        expect(response.body).toMatchObject({
          success: true,
          message: '文件内容缓存已清空',
        })
      })
    })

    describe('Caching behavior', () => {
      it('should use cache on subsequent reads', async () => {
        // First read
        const response1 = await request(app.getHttpServer())
          .get(`/api/files/${textFileId}/content`)
          .query({ encoding: 'utf8' })
          .expect(200)

        expect(response1.body.data.fromCache).toBe(false)

        // Second read should use cache
        const response2 = await request(app.getHttpServer())
          .get(`/api/files/${textFileId}/content`)
          .query({ encoding: 'utf8' })
          .expect(200)

        expect(response2.body.data.fromCache).toBe(true)
        expect(response2.body.data.content).toBe(response1.body.data.content)
      })
    })
  })
})
