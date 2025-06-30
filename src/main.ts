import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import helmet from 'helmet'
import * as compression from 'compression'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)

  // 安全中间件
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false, // 允许文件服务
    })
  )

  // 压缩中间件
  app.use(compression())

  // CORS 配置
  const corsOrigins = configService.get<string>('CORS_ORIGINS')?.split(',') || [
    'http://localhost:3000',
  ]
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  })

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  )

  // API 前缀
  app.setGlobalPrefix('api')

  // 添加简单的根路由处理器
  app.getHttpAdapter().get('/', (req, res) => {
    res.json({
      message: 'Welcome to File Service API',
      version: '1.0.0',
      documentation: '/api',
      health: '/api',
      endpoints: {
        upload: '/api/files/upload',
        files: '/api/files',
        stats: '/api/files/stats',
      },
    })
  })

  // Swagger 文档配置
  const config = new DocumentBuilder()
    .setTitle('文件服务 API')
    .setDescription('用于静态资源管理的综合文件服务')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'JWT-auth'
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-Key',
        in: 'header',
      },
      'API-Key'
    )
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api', app, document)

  const port = configService.get<number>('PORT') || 3001
  await app.listen(port)

  console.log(`🚀 File Service is running on: http://localhost:${port}`)
  console.log(`📚 API Documentation: http://localhost:${port}/api`)
}

bootstrap()
