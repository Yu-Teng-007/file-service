import { Injectable } from '@nestjs/common'

@Injectable()
export class AppService {
  getHealth() {
    return {
      message: 'File Service is running!',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }
  }

  getInfo() {
    return {
      name: 'File Service',
      version: '1.0.0',
      description: 'Independent file service for static resource storage and management',
      features: [
        'Multi-format Support',
        'Security & Validation',
        'Access Control',
        'Auto Classification',
        'Performance Optimization',
        'Management APIs',
        'Docker Ready',
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
