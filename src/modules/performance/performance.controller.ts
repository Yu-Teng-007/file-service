import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger'
import { PerformanceService } from './performance.service'
import { HealthCheckService } from './health-check.service'
import { ApiKeyAuth } from '../auth/decorators/api-key-auth.decorator'

@ApiTags('性能监控')
@Controller('performance')
export class PerformanceController {
  constructor(
    private readonly performanceService: PerformanceService,
    private readonly healthCheckService: HealthCheckService
  ) {}

  @Get('health')
  @ApiOperation({ summary: '完整健康检查' })
  @ApiResponse({ status: 200, description: '健康检查结果' })
  @HttpCode(HttpStatus.OK)
  async healthCheck() {
    const result = await this.healthCheckService.performHealthCheck()
    
    return {
      success: true,
      data: result,
    }
  }

  @Get('health/quick')
  @ApiOperation({ summary: '快速健康检查' })
  @ApiResponse({ status: 200, description: '快速健康检查结果' })
  @HttpCode(HttpStatus.OK)
  async quickHealthCheck() {
    const result = await this.healthCheckService.quickHealthCheck()
    
    return result.status === 'ok' 
      ? { status: 'ok', timestamp: result.timestamp }
      : { status: 'error', timestamp: result.timestamp }
  }

  @Get('health/ready')
  @ApiOperation({ summary: '就绪状态检查' })
  @ApiResponse({ status: 200, description: '就绪状态' })
  @HttpCode(HttpStatus.OK)
  async readinessCheck() {
    const result = await this.healthCheckService.getReadinessStatus()
    
    return {
      ready: result.ready,
      timestamp: result.timestamp,
      details: result.details,
    }
  }

  @Get('health/live')
  @ApiOperation({ summary: '存活状态检查' })
  @ApiResponse({ status: 200, description: '存活状态' })
  @HttpCode(HttpStatus.OK)
  async livenessCheck() {
    const result = await this.healthCheckService.getLivenessStatus()
    
    return {
      alive: result.alive,
      timestamp: result.timestamp,
    }
  }

  @Get('metrics')
  @ApiOperation({ summary: '获取性能指标' })
  @ApiResponse({ status: 200, description: '性能指标数据' })
  @ApiKeyAuth()
  async getMetrics() {
    const summary = this.performanceService.getPerformanceSummary()
    
    return {
      success: true,
      data: summary,
    }
  }

  @Get('metrics/system')
  @ApiOperation({ summary: '获取系统指标' })
  @ApiResponse({ status: 200, description: '系统指标数据' })
  @ApiKeyAuth()
  async getSystemMetrics() {
    const metrics = await this.performanceService.getSystemMetrics()
    
    return {
      success: true,
      data: metrics,
    }
  }

  @Get('metrics/application')
  @ApiOperation({ summary: '获取应用指标' })
  @ApiResponse({ status: 200, description: '应用指标数据' })
  @ApiKeyAuth()
  async getApplicationMetrics() {
    const metrics = this.performanceService.getApplicationMetrics()
    
    return {
      success: true,
      data: metrics,
    }
  }

  @Get('metrics/:name/history')
  @ApiOperation({ summary: '获取指标历史数据' })
  @ApiParam({ name: 'name', description: '指标名称' })
  @ApiQuery({ name: 'limit', required: false, description: '返回记录数量限制' })
  @ApiResponse({ status: 200, description: '指标历史数据' })
  @ApiKeyAuth()
  async getMetricHistory(
    @Param('name') name: string,
    @Query('limit') limit?: string
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 100
    const history = this.performanceService.getMetricHistory(name, limitNum)
    
    return {
      success: true,
      data: {
        metric: name,
        history,
        count: history.length,
      },
    }
  }

  @Get('alerts')
  @ApiOperation({ summary: '获取性能告警' })
  @ApiQuery({ name: 'includeResolved', required: false, description: '是否包含已解决的告警' })
  @ApiResponse({ status: 200, description: '告警列表' })
  @ApiKeyAuth()
  async getAlerts(@Query('includeResolved') includeResolved?: string) {
    const includeResolvedBool = includeResolved === 'true'
    const alerts = this.performanceService.getAlerts(includeResolvedBool)
    
    return {
      success: true,
      data: {
        alerts,
        total: alerts.length,
        active: alerts.filter(a => !a.resolved).length,
        resolved: alerts.filter(a => a.resolved).length,
      },
    }
  }

  @Post('alerts/:id/resolve')
  @ApiOperation({ summary: '解决告警' })
  @ApiParam({ name: 'id', description: '告警ID' })
  @ApiResponse({ status: 200, description: '告警已解决' })
  @ApiKeyAuth()
  async resolveAlert(@Param('id') id: string) {
    const resolved = this.performanceService.resolveAlert(id)
    
    return {
      success: resolved,
      message: resolved ? '告警已解决' : '告警不存在',
    }
  }

  @Get('prometheus')
  @ApiOperation({ summary: '获取Prometheus格式的指标' })
  @ApiResponse({ 
    status: 200, 
    description: 'Prometheus格式的指标数据',
    content: {
      'text/plain': {
        schema: {
          type: 'string',
        },
      },
    },
  })
  async getPrometheusMetrics() {
    const systemMetrics = await this.performanceService.getSystemMetrics()
    const appMetrics = this.performanceService.getApplicationMetrics()
    
    // 生成Prometheus格式的指标
    const metrics = [
      // 系统指标
      `# HELP cpu_usage_percent CPU使用率`,
      `# TYPE cpu_usage_percent gauge`,
      `cpu_usage_percent ${systemMetrics.cpu.usage}`,
      '',
      `# HELP memory_usage_percent 内存使用率`,
      `# TYPE memory_usage_percent gauge`,
      `memory_usage_percent ${systemMetrics.memory.usage}`,
      '',
      `# HELP memory_used_bytes 已使用内存字节数`,
      `# TYPE memory_used_bytes gauge`,
      `memory_used_bytes ${systemMetrics.memory.used}`,
      '',
      `# HELP process_uptime_seconds 进程运行时间`,
      `# TYPE process_uptime_seconds counter`,
      `process_uptime_seconds ${systemMetrics.process.uptime}`,
      '',
      // 应用指标
      `# HELP http_requests_total HTTP请求总数`,
      `# TYPE http_requests_total counter`,
      `http_requests_total{status="success"} ${appMetrics.requests.success}`,
      `http_requests_total{status="error"} ${appMetrics.requests.error}`,
      '',
      `# HELP http_request_duration_ms HTTP请求响应时间`,
      `# TYPE http_request_duration_ms gauge`,
      `http_request_duration_ms ${appMetrics.requests.averageResponseTime}`,
      '',
      `# HELP file_operations_total 文件操作总数`,
      `# TYPE file_operations_total counter`,
      `file_operations_total{operation="upload"} ${appMetrics.files.totalUploaded}`,
      `file_operations_total{operation="download"} ${appMetrics.files.totalDownloaded}`,
      '',
      `# HELP file_size_bytes_total 文件总大小`,
      `# TYPE file_size_bytes_total counter`,
      `file_size_bytes_total ${appMetrics.files.totalSize}`,
      '',
      `# HELP errors_total 错误总数`,
      `# TYPE errors_total counter`,
      `errors_total ${appMetrics.errors.total}`,
      '',
    ]

    // 添加错误类型指标
    for (const [errorType, count] of Object.entries(appMetrics.errors.byType)) {
      metrics.push(`errors_by_type{type="${errorType}"} ${count}`)
    }

    return metrics.join('\n')
  }

  @Get('dashboard')
  @ApiOperation({ summary: '获取监控仪表板数据' })
  @ApiResponse({ status: 200, description: '仪表板数据' })
  @ApiKeyAuth()
  async getDashboardData() {
    const summary = this.performanceService.getPerformanceSummary()
    const alerts = this.performanceService.getAlerts()
    
    // 获取最近的指标趋势
    const cpuHistory = this.performanceService.getMetricHistory('cpu_usage_percent', 20)
    const memoryHistory = this.performanceService.getMetricHistory('memory_usage_percent', 20)
    const responseTimeHistory = this.performanceService.getMetricHistory('http_request_duration_ms', 20)
    
    return {
      success: true,
      data: {
        summary,
        alerts: {
          active: alerts.filter(a => !a.resolved),
          total: alerts.length,
        },
        trends: {
          cpu: cpuHistory.map(m => ({ timestamp: m.timestamp, value: m.value })),
          memory: memoryHistory.map(m => ({ timestamp: m.timestamp, value: m.value })),
          responseTime: responseTimeHistory.map(m => ({ timestamp: m.timestamp, value: m.value })),
        },
        timestamp: new Date(),
      },
    }
  }
}
