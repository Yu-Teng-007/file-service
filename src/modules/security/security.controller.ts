import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger'
import { SecurityService } from './security.service'
import { AccessControlService } from './access-control.service'
import { RateLimitService } from './rate-limit.service'
import { ApiKeyAuth } from '../auth/decorators/api-key-auth.decorator'

@ApiTags('安全管理')
@Controller('security')
@ApiKeyAuth()
export class SecurityController {
  constructor(
    private readonly securityService: SecurityService,
    private readonly accessControlService: AccessControlService,
    private readonly rateLimitService: RateLimitService
  ) {}

  @Get('access-logs')
  @ApiOperation({ summary: '获取访问日志' })
  @ApiQuery({ name: 'limit', required: false, description: '返回记录数量限制' })
  @ApiResponse({ status: 200, description: '访问日志列表' })
  getAccessLogs(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 100
    const logs = this.accessControlService.getAccessLogs(limitNum)
    
    return {
      success: true,
      data: {
        logs,
        total: logs.length,
      },
    }
  }

  @Get('suspicious-ips')
  @ApiOperation({ summary: '获取可疑IP列表' })
  @ApiResponse({ status: 200, description: '可疑IP列表' })
  getSuspiciousIPs() {
    const suspiciousIPs = this.accessControlService.getSuspiciousIPs()
    
    return {
      success: true,
      data: {
        suspiciousIPs,
        total: suspiciousIPs.length,
      },
    }
  }

  @Post('blacklist/:ip')
  @ApiOperation({ summary: '添加IP到黑名单' })
  @ApiParam({ name: 'ip', description: 'IP地址' })
  @ApiResponse({ status: 200, description: 'IP已添加到黑名单' })
  addToBlacklist(@Param('ip') ip: string) {
    this.accessControlService.addToBlacklist(ip)
    
    return {
      success: true,
      message: `IP ${ip} 已添加到黑名单`,
    }
  }

  @Delete('blacklist/:ip')
  @ApiOperation({ summary: '从黑名单移除IP' })
  @ApiParam({ name: 'ip', description: 'IP地址' })
  @ApiResponse({ status: 200, description: 'IP已从黑名单移除' })
  removeFromBlacklist(@Param('ip') ip: string) {
    const removed = this.accessControlService.removeFromBlacklist(ip)
    
    return {
      success: true,
      message: removed ? `IP ${ip} 已从黑名单移除` : `IP ${ip} 不在黑名单中`,
    }
  }

  @Post('whitelist/:ip')
  @ApiOperation({ summary: '添加IP到白名单' })
  @ApiParam({ name: 'ip', description: 'IP地址' })
  @ApiResponse({ status: 200, description: 'IP已添加到白名单' })
  addToWhitelist(@Param('ip') ip: string) {
    this.accessControlService.addToWhitelist(ip)
    
    return {
      success: true,
      message: `IP ${ip} 已添加到白名单`,
    }
  }

  @Delete('whitelist/:ip')
  @ApiOperation({ summary: '从白名单移除IP' })
  @ApiParam({ name: 'ip', description: 'IP地址' })
  @ApiResponse({ status: 200, description: 'IP已从白名单移除' })
  removeFromWhitelist(@Param('ip') ip: string) {
    const removed = this.accessControlService.removeFromWhitelist(ip)
    
    return {
      success: true,
      message: removed ? `IP ${ip} 已从白名单移除` : `IP ${ip} 不在白名单中`,
    }
  }

  @Get('rate-limit/status')
  @ApiOperation({ summary: '获取当前限流状态' })
  @ApiResponse({ status: 200, description: '限流状态信息' })
  getRateLimitStatus(@Request() req) {
    const context = {
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      endpoint: req.path,
      method: req.method,
      timestamp: new Date(),
    }

    const status = this.rateLimitService.getCurrentStatus(context)
    
    return {
      success: true,
      data: {
        status,
        context: {
          ip: context.ipAddress,
          endpoint: context.endpoint,
          method: context.method,
        },
      },
    }
  }

  @Get('rate-limit/statistics')
  @ApiOperation({ summary: '获取限流统计信息' })
  @ApiResponse({ status: 200, description: '限流统计信息' })
  getRateLimitStatistics() {
    const statistics = this.rateLimitService.getStatistics()
    
    return {
      success: true,
      data: statistics,
    }
  }

  @Post('rate-limit/reset/:key')
  @ApiOperation({ summary: '重置特定键的限流计数' })
  @ApiParam({ name: 'key', description: '限流键' })
  @ApiResponse({ status: 200, description: '限流计数已重置' })
  resetRateLimit(@Param('key') key: string) {
    const reset = this.rateLimitService.resetLimit(key)
    
    return {
      success: true,
      message: reset ? `限流计数 ${key} 已重置` : `限流计数 ${key} 不存在`,
    }
  }

  @Post('scan/file')
  @ApiOperation({ summary: '扫描文件安全性' })
  @ApiResponse({ status: 200, description: '文件安全扫描结果' })
  async scanFile(@Body() body: { filePath: string; fileName: string }) {
    const { filePath, fileName } = body
    
    try {
      const result = await this.securityService.scanFile(filePath, fileName)
      
      return {
        success: true,
        data: result,
      }
    } catch (error) {
      return {
        success: false,
        message: '文件扫描失败',
        error: error.message,
      }
    }
  }

  @Post('cleanup/suspicious-ips')
  @ApiOperation({ summary: '清理过期的可疑IP记录' })
  @ApiResponse({ status: 200, description: '清理完成' })
  cleanupSuspiciousIPs() {
    this.accessControlService.cleanupSuspiciousIPs()
    
    return {
      success: true,
      message: '可疑IP记录清理完成',
    }
  }

  @Get('health')
  @ApiOperation({ summary: '安全模块健康检查' })
  @ApiResponse({ status: 200, description: '健康状态' })
  healthCheck() {
    const rateLimitStats = this.rateLimitService.getStatistics()
    const suspiciousIPs = this.accessControlService.getSuspiciousIPs()
    
    return {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date(),
        statistics: {
          rateLimitRules: rateLimitStats.totalRules,
          activeRateLimitRecords: rateLimitStats.activeRecords,
          suspiciousIPCount: suspiciousIPs.length,
        },
      },
    }
  }
}
