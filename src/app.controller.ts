import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { AppService } from './app.service'

@ApiTags('system')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: '系统健康检查', description: '检查文件服务系统状态' })
  @ApiResponse({ 
    status: 200, 
    description: '系统正常运行',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'File Service is running!' },
        version: { type: 'string', example: '1.0.0' },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        uptime: { type: 'number', example: 12345 }
      }
    }
  })
  getHealth() {
    return this.appService.getHealth()
  }

  @Get('info')
  @ApiOperation({ summary: '获取系统信息', description: '获取文件服务系统详细信息' })
  @ApiResponse({ 
    status: 200, 
    description: '系统信息',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'File Service' },
        version: { type: 'string', example: '1.0.0' },
        description: { type: 'string', example: 'Independent file service for static resource storage' },
        features: { 
          type: 'array', 
          items: { type: 'string' },
          example: ['Multi-format Support', 'Security', 'Access Control']
        },
        supportedFormats: {
          type: 'object',
          properties: {
            images: { type: 'array', items: { type: 'string' } },
            scripts: { type: 'array', items: { type: 'string' } },
            styles: { type: 'array', items: { type: 'string' } },
            fonts: { type: 'array', items: { type: 'string' } },
            documents: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  })
  getInfo() {
    return this.appService.getInfo()
  }
}
