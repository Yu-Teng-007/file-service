import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import * as os from 'os'
import * as process from 'process'

export interface PerformanceMetric {
  name: string
  value: number
  unit: string
  timestamp: Date
  labels?: Record<string, string>
}

export interface SystemMetrics {
  cpu: {
    usage: number
    loadAverage: number[]
  }
  memory: {
    used: number
    free: number
    total: number
    usage: number
  }
  disk: {
    used: number
    free: number
    total: number
    usage: number
  }
  network: {
    bytesReceived: number
    bytesSent: number
  }
  process: {
    pid: number
    uptime: number
    memoryUsage: NodeJS.MemoryUsage
    cpuUsage: NodeJS.CpuUsage
  }
}

export interface ApplicationMetrics {
  requests: {
    total: number
    success: number
    error: number
    averageResponseTime: number
  }
  files: {
    totalUploaded: number
    totalDownloaded: number
    totalSize: number
    averageUploadTime: number
    averageDownloadTime: number
  }
  cache: {
    hits: number
    misses: number
    hitRate: number
    memoryUsage: number
  }
  errors: {
    total: number
    byType: Record<string, number>
    recentErrors: Array<{ message: string; timestamp: Date; count: number }>
  }
}

export interface PerformanceAlert {
  id: string
  type: 'cpu' | 'memory' | 'disk' | 'response_time' | 'error_rate' | 'custom'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  threshold: number
  currentValue: number
  timestamp: Date
  resolved: boolean
}

@Injectable()
export class PerformanceService {
  private readonly logger = new Logger(PerformanceService.name)
  private readonly metrics: Map<string, PerformanceMetric[]> = new Map()
  private readonly alerts: PerformanceAlert[] = []
  private readonly requestMetrics = {
    total: 0,
    success: 0,
    error: 0,
    responseTimes: [] as number[],
  }
  private readonly fileMetrics = {
    uploaded: 0,
    downloaded: 0,
    totalSize: 0,
    uploadTimes: [] as number[],
    downloadTimes: [] as number[],
  }
  private readonly errorMetrics = {
    total: 0,
    byType: new Map<string, number>(),
    recent: [] as Array<{ message: string; timestamp: Date; count: number }>,
  }

  private startTime = Date.now()
  private lastCpuUsage = process.cpuUsage()

  constructor(private readonly configService: ConfigService) {
    this.initializeMetricsCollection()
  }

  /**
   * 初始化指标收集
   */
  private initializeMetricsCollection(): void {
    // 立即收集一次基线指标
    this.collectSystemMetrics()
    this.logger.log('性能监控服务已启动')
  }

  /**
   * 记录请求指标
   */
  recordRequest(responseTime: number, success: boolean): void {
    this.requestMetrics.total++
    if (success) {
      this.requestMetrics.success++
    } else {
      this.requestMetrics.error++
    }
    
    this.requestMetrics.responseTimes.push(responseTime)
    
    // 保持最近1000个响应时间记录
    if (this.requestMetrics.responseTimes.length > 1000) {
      this.requestMetrics.responseTimes = this.requestMetrics.responseTimes.slice(-500)
    }

    // 记录指标
    this.recordMetric('http_requests_total', this.requestMetrics.total, 'count')
    this.recordMetric('http_request_duration_ms', responseTime, 'milliseconds')
    
    // 检查响应时间告警
    this.checkResponseTimeAlert(responseTime)
  }

  /**
   * 记录文件操作指标
   */
  recordFileOperation(
    operation: 'upload' | 'download',
    fileSize: number,
    duration: number
  ): void {
    if (operation === 'upload') {
      this.fileMetrics.uploaded++
      this.fileMetrics.uploadTimes.push(duration)
    } else {
      this.fileMetrics.downloaded++
      this.fileMetrics.downloadTimes.push(duration)
    }
    
    this.fileMetrics.totalSize += fileSize
    
    // 保持最近500个操作时间记录
    if (this.fileMetrics.uploadTimes.length > 500) {
      this.fileMetrics.uploadTimes = this.fileMetrics.uploadTimes.slice(-250)
    }
    if (this.fileMetrics.downloadTimes.length > 500) {
      this.fileMetrics.downloadTimes = this.fileMetrics.downloadTimes.slice(-250)
    }

    // 记录指标
    this.recordMetric(`file_${operation}_total`, 
      operation === 'upload' ? this.fileMetrics.uploaded : this.fileMetrics.downloaded, 
      'count'
    )
    this.recordMetric(`file_${operation}_duration_ms`, duration, 'milliseconds')
    this.recordMetric('file_size_bytes', fileSize, 'bytes')
  }

  /**
   * 记录错误指标
   */
  recordError(errorType: string, errorMessage: string): void {
    this.errorMetrics.total++
    
    const currentCount = this.errorMetrics.byType.get(errorType) || 0
    this.errorMetrics.byType.set(errorType, currentCount + 1)
    
    // 更新最近错误
    const existing = this.errorMetrics.recent.find(e => e.message === errorMessage)
    if (existing) {
      existing.count++
      existing.timestamp = new Date()
    } else {
      this.errorMetrics.recent.push({
        message: errorMessage,
        timestamp: new Date(),
        count: 1,
      })
    }
    
    // 保持最近100个错误记录
    if (this.errorMetrics.recent.length > 100) {
      this.errorMetrics.recent = this.errorMetrics.recent.slice(-50)
    }

    // 记录指标
    this.recordMetric('errors_total', this.errorMetrics.total, 'count')
    this.recordMetric('errors_by_type', currentCount + 1, 'count', { type: errorType })
    
    // 检查错误率告警
    this.checkErrorRateAlert()
  }

  /**
   * 记录自定义指标
   */
  recordMetric(
    name: string,
    value: number,
    unit: string,
    labels?: Record<string, string>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      labels,
    }

    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }

    const metricArray = this.metrics.get(name)!
    metricArray.push(metric)

    // 保持最近1000个指标记录
    if (metricArray.length > 1000) {
      this.metrics.set(name, metricArray.slice(-500))
    }
  }

  /**
   * 定时收集系统指标
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async collectSystemMetrics(): Promise<void> {
    try {
      const metrics = await this.getSystemMetrics()
      
      // 记录系统指标
      this.recordMetric('cpu_usage_percent', metrics.cpu.usage, 'percent')
      this.recordMetric('memory_usage_percent', metrics.memory.usage, 'percent')
      this.recordMetric('memory_used_bytes', metrics.memory.used, 'bytes')
      this.recordMetric('process_uptime_seconds', metrics.process.uptime, 'seconds')
      this.recordMetric('process_memory_rss_bytes', metrics.process.memoryUsage.rss, 'bytes')
      this.recordMetric('process_memory_heap_used_bytes', metrics.process.memoryUsage.heapUsed, 'bytes')
      
      // 检查系统告警
      this.checkSystemAlerts(metrics)
      
    } catch (error) {
      this.logger.error('收集系统指标失败', error)
    }
  }

  /**
   * 获取系统指标
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const cpuUsage = process.cpuUsage(this.lastCpuUsage)
    this.lastCpuUsage = process.cpuUsage()
    
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem
    
    return {
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000 * 100, // 转换为百分比
        loadAverage: os.loadavg(),
      },
      memory: {
        used: usedMem,
        free: freeMem,
        total: totalMem,
        usage: (usedMem / totalMem) * 100,
      },
      disk: {
        used: 0, // 需要额外的库来获取磁盘使用情况
        free: 0,
        total: 0,
        usage: 0,
      },
      network: {
        bytesReceived: 0, // 需要额外的库来获取网络统计
        bytesSent: 0,
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage,
      },
    }
  }

  /**
   * 获取应用指标
   */
  getApplicationMetrics(): ApplicationMetrics {
    const avgResponseTime = this.requestMetrics.responseTimes.length > 0
      ? this.requestMetrics.responseTimes.reduce((a, b) => a + b, 0) / this.requestMetrics.responseTimes.length
      : 0

    const avgUploadTime = this.fileMetrics.uploadTimes.length > 0
      ? this.fileMetrics.uploadTimes.reduce((a, b) => a + b, 0) / this.fileMetrics.uploadTimes.length
      : 0

    const avgDownloadTime = this.fileMetrics.downloadTimes.length > 0
      ? this.fileMetrics.downloadTimes.reduce((a, b) => a + b, 0) / this.fileMetrics.downloadTimes.length
      : 0

    return {
      requests: {
        total: this.requestMetrics.total,
        success: this.requestMetrics.success,
        error: this.requestMetrics.error,
        averageResponseTime: avgResponseTime,
      },
      files: {
        totalUploaded: this.fileMetrics.uploaded,
        totalDownloaded: this.fileMetrics.downloaded,
        totalSize: this.fileMetrics.totalSize,
        averageUploadTime: avgUploadTime,
        averageDownloadTime: avgDownloadTime,
      },
      cache: {
        hits: 0, // 需要从缓存服务获取
        misses: 0,
        hitRate: 0,
        memoryUsage: 0,
      },
      errors: {
        total: this.errorMetrics.total,
        byType: Object.fromEntries(this.errorMetrics.byType),
        recentErrors: this.errorMetrics.recent.slice(-10),
      },
    }
  }

  /**
   * 获取指标历史数据
   */
  getMetricHistory(metricName: string, limit: number = 100): PerformanceMetric[] {
    const metrics = this.metrics.get(metricName) || []
    return metrics.slice(-limit)
  }

  /**
   * 获取所有告警
   */
  getAlerts(includeResolved: boolean = false): PerformanceAlert[] {
    return this.alerts.filter(alert => includeResolved || !alert.resolved)
  }

  /**
   * 解决告警
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.resolved = true
      this.logger.log(`告警已解决: ${alert.message}`)
      return true
    }
    return false
  }

  /**
   * 检查响应时间告警
   */
  private checkResponseTimeAlert(responseTime: number): void {
    const threshold = this.configService.get<number>('PERFORMANCE_RESPONSE_TIME_THRESHOLD', 5000)
    
    if (responseTime > threshold) {
      this.createAlert({
        type: 'response_time',
        severity: responseTime > threshold * 2 ? 'critical' : 'high',
        message: `响应时间过长: ${responseTime}ms`,
        threshold,
        currentValue: responseTime,
      })
    }
  }

  /**
   * 检查错误率告警
   */
  private checkErrorRateAlert(): void {
    if (this.requestMetrics.total < 10) return // 请求数太少，不检查错误率
    
    const errorRate = (this.requestMetrics.error / this.requestMetrics.total) * 100
    const threshold = this.configService.get<number>('PERFORMANCE_ERROR_RATE_THRESHOLD', 5)
    
    if (errorRate > threshold) {
      this.createAlert({
        type: 'error_rate',
        severity: errorRate > threshold * 2 ? 'critical' : 'high',
        message: `错误率过高: ${errorRate.toFixed(2)}%`,
        threshold,
        currentValue: errorRate,
      })
    }
  }

  /**
   * 检查系统告警
   */
  private checkSystemAlerts(metrics: SystemMetrics): void {
    // CPU使用率告警
    const cpuThreshold = this.configService.get<number>('PERFORMANCE_CPU_THRESHOLD', 80)
    if (metrics.cpu.usage > cpuThreshold) {
      this.createAlert({
        type: 'cpu',
        severity: metrics.cpu.usage > cpuThreshold * 1.2 ? 'critical' : 'high',
        message: `CPU使用率过高: ${metrics.cpu.usage.toFixed(2)}%`,
        threshold: cpuThreshold,
        currentValue: metrics.cpu.usage,
      })
    }

    // 内存使用率告警
    const memoryThreshold = this.configService.get<number>('PERFORMANCE_MEMORY_THRESHOLD', 85)
    if (metrics.memory.usage > memoryThreshold) {
      this.createAlert({
        type: 'memory',
        severity: metrics.memory.usage > memoryThreshold * 1.1 ? 'critical' : 'high',
        message: `内存使用率过高: ${metrics.memory.usage.toFixed(2)}%`,
        threshold: memoryThreshold,
        currentValue: metrics.memory.usage,
      })
    }
  }

  /**
   * 创建告警
   */
  private createAlert(alertData: Omit<PerformanceAlert, 'id' | 'timestamp' | 'resolved'>): void {
    const alert: PerformanceAlert = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      resolved: false,
      ...alertData,
    }

    this.alerts.push(alert)
    this.logger.warn(`性能告警: ${alert.message}`)

    // 保持最近100个告警
    if (this.alerts.length > 100) {
      this.alerts.splice(0, 50)
    }
  }

  /**
   * 获取性能摘要
   */
  getPerformanceSummary(): {
    uptime: number
    systemMetrics: SystemMetrics
    applicationMetrics: ApplicationMetrics
    activeAlerts: number
    healthScore: number
  } {
    const uptime = Date.now() - this.startTime
    const systemMetrics = this.getSystemMetrics()
    const applicationMetrics = this.getApplicationMetrics()
    const activeAlerts = this.getAlerts().length
    
    // 计算健康分数 (0-100)
    const healthScore = this.calculateHealthScore(systemMetrics, applicationMetrics, activeAlerts)

    return {
      uptime,
      systemMetrics: systemMetrics as any, // 临时类型转换
      applicationMetrics,
      activeAlerts,
      healthScore,
    }
  }

  /**
   * 计算健康分数
   */
  private calculateHealthScore(
    systemMetrics: any,
    applicationMetrics: ApplicationMetrics,
    activeAlerts: number
  ): number {
    let score = 100

    // 系统指标影响 (40%)
    if (systemMetrics.cpu?.usage > 80) score -= 20
    else if (systemMetrics.cpu?.usage > 60) score -= 10
    
    if (systemMetrics.memory?.usage > 85) score -= 20
    else if (systemMetrics.memory?.usage > 70) score -= 10

    // 应用指标影响 (40%)
    const errorRate = applicationMetrics.requests.total > 0 
      ? (applicationMetrics.requests.error / applicationMetrics.requests.total) * 100 
      : 0
    
    if (errorRate > 5) score -= 20
    else if (errorRate > 2) score -= 10

    if (applicationMetrics.requests.averageResponseTime > 5000) score -= 15
    else if (applicationMetrics.requests.averageResponseTime > 2000) score -= 8

    // 告警影响 (20%)
    score -= Math.min(activeAlerts * 5, 20)

    return Math.max(0, Math.min(100, score))
  }
}
