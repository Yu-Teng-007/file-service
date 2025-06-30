import { Injectable } from '@nestjs/common'

@Injectable()
export class AppService {
  getHealth() {
    return {
      message: '文件服务正在运行！',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }
  }

  getInfo() {
    return {
      name: '文件服务',
      version: '1.0.0',
      description: '用于静态资源存储和管理的独立文件服务',
      features: [
        '多格式支持',
        '安全验证',
        '访问控制',
        '自动分类',
        '性能优化',
        '管理接口',
        'Docker 支持',
      ],
      supportedFormats: {
        images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
        scripts: ['js', 'ts', 'json'],
        styles: ['css', 'scss', 'less'],
        fonts: ['ttf', 'woff', 'woff2', 'eot'],
        documents: ['pdf', 'txt', 'doc', 'docx'],
        music: ['mp3', 'wav', 'flac', 'ogg'],
      },
      endpoints: {
        upload: 'POST /api/files/upload',
        list: 'GET /api/files',
        info: 'GET /api/files/:id',
        delete: 'DELETE /api/files/:id',
        access: 'GET /uploads/:category/:filename',
      },
    }
  }
}
