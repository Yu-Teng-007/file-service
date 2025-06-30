import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger'
import { MonitoringService } from './monitoring.service'
import { AlertRule } from './interfaces/monitoring.interface'

export class DateRangeDto {
  startDate: string
  endDate: string
}

export class AlertRuleDto {
  name: string
  description: string
  metric: string
  operator: '>' | '<' | '>=' | '<=' | '==' | '!='
  threshold: number
  enabled: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
  actions: Array<{
    type: 'email' | 'webhook' | 'log'
    config: any
  }>
}

@ApiTags('monitoring')
@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('storage/stats')
  @ApiOperation({ summary: '获取存储统计', description: '获取文件存储使用情况统计' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取存储统计成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            totalFiles: { type: 'number' },
            totalSize: { type: 'number' },
            usedSpace: { type: 'number' },
            availableSpace: { type: 'number' },
            usagePercentage: { type: 'number' },
            categoryBreakdown: { type: 'object' },
          },
        },
      },
    },
  })
  async getStorageStats() {
    const stats = await this.monitoringService.getStorageStats()
    return {
      success: true,
      message: '获取存储统计成功',
      data: stats,
    }
  }

  @Get('performance/metrics')
  @ApiOperation({ summary: '获取性能指标', description: '获取系统性能监控指标' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取性能指标成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            averageResponseTime: { type: 'number' },
            requestsPerSecond: { type: 'number' },
            errorRate: { type: 'number' },
            throughput: { type: 'number' },
            activeConnections: { type: 'number' },
            memoryUsage: { type: 'object' },
            cpuUsage: { type: 'number' },
          },
        },
      },
    },
  })
  async getPerformanceMetrics() {
    const metrics = await this.monitoringService.getPerformanceMetrics()
    return {
      success: true,
      message: '获取性能指标成功',
      data: metrics,
    }
  }

  @Get('files/popular')
  @ApiOperation({ summary: '获取热门文件', description: '获取访问量最高的文件统计' })
  @ApiQuery({ name: 'limit', required: false, description: '返回数量限制', example: 10 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取热门文件成功',
  })
  async getPopularFiles(@Query('limit') limit = 10) {
    const limitNum = parseInt(limit.toString())
    if (isNaN(limitNum) || limitNum <= 0) {
      throw new BadRequestException('limit必须是正整数')
    }

    const popularFiles = await this.monitoringService.getFilePopularityStats(limitNum)
    return {
      success: true,
      message: '获取热门文件成功',
      data: popularFiles,
    }
  }

  @Get('access/patterns')
  @ApiOperation({ summary: '获取访问模式', description: '获取文件访问时间模式分析' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取访问模式成功',
  })
  async getAccessPatterns() {
    const patterns = await this.monitoringService.getAccessPatterns()
    return {
      success: true,
      message: '获取访问模式成功',
      data: patterns,
    }
  }

  @Get('errors/stats')
  @ApiOperation({ summary: '获取错误统计', description: '获取系统错误统计信息' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取错误统计成功',
  })
  async getErrorStats() {
    const errorStats = await this.monitoringService.getErrorStats()
    return {
      success: true,
      message: '获取错误统计成功',
      data: errorStats,
    }
  }

  @Get('system/health')
  @ApiOperation({ summary: '获取系统健康状态', description: '获取系统整体健康状态' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取系统健康状态成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'warning', 'critical'] },
            uptime: { type: 'number' },
            lastCheck: { type: 'string' },
            services: { type: 'array' },
            alerts: { type: 'array' },
          },
        },
      },
    },
  })
  async getSystemHealth() {
    const health = await this.monitoringService.getSystemHealth()
    return {
      success: true,
      message: '获取系统健康状态成功',
      data: health,
    }
  }

  @Post('reports/generate')
  @ApiOperation({ summary: '生成监控报告', description: '生成指定时间范围的监控报告' })
  @ApiBody({
    description: '报告生成请求',
    schema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', format: 'date-time', description: '开始时间' },
        endDate: { type: 'string', format: 'date-time', description: '结束时间' },
      },
      required: ['startDate', 'endDate'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '生成监控报告成功',
  })
  async generateReport(@Body() dateRange: DateRangeDto) {
    const startDate = new Date(dateRange.startDate)
    const endDate = new Date(dateRange.endDate)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('无效的日期格式')
    }

    if (startDate >= endDate) {
      throw new BadRequestException('开始时间必须早于结束时间')
    }

    const report = await this.monitoringService.generateReport(startDate, endDate)
    return {
      success: true,
      message: '生成监控报告成功',
      data: report,
    }
  }

  @Get('alerts/rules')
  @ApiOperation({ summary: '获取告警规则', description: '获取所有告警规则列表' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取告警规则成功',
  })
  async getAlertRules() {
    const rules = await this.monitoringService.getAlertRules()
    return {
      success: true,
      message: '获取告警规则成功',
      data: rules,
    }
  }

  @Post('alerts/rules')
  @ApiOperation({ summary: '添加告警规则', description: '添加新的告警规则' })
  @ApiBody({
    description: '告警规则',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '规则名称' },
        description: { type: 'string', description: '规则描述' },
        metric: { type: 'string', description: '监控指标' },
        operator: { type: 'string', enum: ['>', '<', '>=', '<=', '==', '!='], description: '比较操作符' },
        threshold: { type: 'number', description: '阈值' },
        enabled: { type: 'boolean', description: '是否启用' },
        severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: '严重程度' },
        actions: { type: 'array', description: '告警动作' },
      },
      required: ['name', 'description', 'metric', 'operator', 'threshold', 'enabled', 'severity', 'actions'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '添加告警规则成功',
  })
  async addAlertRule(@Body() ruleDto: AlertRuleDto) {
    const rule = await this.monitoringService.addAlertRule(ruleDto)
    return {
      success: true,
      message: '添加告警规则成功',
      data: rule,
    }
  }

  @Get('alerts/active')
  @ApiOperation({ summary: '获取活跃告警', description: '获取当前未解决的告警列表' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取活跃告警成功',
  })
  async getActiveAlerts() {
    const alerts = await this.monitoringService.getActiveAlerts()
    return {
      success: true,
      message: '获取活跃告警成功',
      data: alerts,
    }
  }

  @Get('dashboard')
  @ApiOperation({ summary: '获取监控仪表板', description: '获取监控仪表板汇总数据' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取监控仪表板成功',
  })
  async getDashboard() {
    const [
      storageStats,
      performanceMetrics,
      systemHealth,
      popularFiles,
      activeAlerts,
    ] = await Promise.all([
      this.monitoringService.getStorageStats(),
      this.monitoringService.getPerformanceMetrics(),
      this.monitoringService.getSystemHealth(),
      this.monitoringService.getFilePopularityStats(5),
      this.monitoringService.getActiveAlerts(),
    ])

    return {
      success: true,
      message: '获取监控仪表板成功',
      data: {
        storageStats,
        performanceMetrics,
        systemHealth,
        popularFiles,
        activeAlerts,
        summary: {
          totalFiles: storageStats.totalFiles,
          storageUsage: storageStats.usagePercentage,
          systemStatus: systemHealth.status,
          activeAlertsCount: activeAlerts.length,
          averageResponseTime: performanceMetrics.averageResponseTime,
          errorRate: performanceMetrics.errorRate,
        },
      },
    }
  }
}
