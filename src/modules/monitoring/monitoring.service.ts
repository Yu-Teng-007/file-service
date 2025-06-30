import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { promises as fs } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import * as os from 'os'
import {
  FileAccessLog,
  StorageStats,
  PerformanceMetrics,
  FilePopularityStats,
  AccessPattern,
  ErrorStats,
  SystemHealth,
  MonitoringReport,
  AlertRule,
  Alert,
  MonitoringConfig,
} from './interfaces/monitoring.interface'

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name)
  private accessLogs: FileAccessLog[] = []
  private performanceMetrics: PerformanceMetrics[] = []
  private alerts: Alert[] = []
  private alertRules: AlertRule[] = []
  private config: MonitoringConfig
  private startTime = Date.now()

  constructor(private configService: ConfigService) {
    this.config = this.loadConfig()
    this.initializeDefaultAlertRules()
  }

  /**
   * 记录文件访问日志
   */
  async logFileAccess(log: Omit<FileAccessLog, 'id' | 'timestamp'>): Promise<void> {
    if (!this.config.enableAccessLogging) return

    const accessLog: FileAccessLog = {
      id: uuidv4(),
      timestamp: new Date(),
      ...log,
    }

    this.accessLogs.push(accessLog)
    this.logger.debug(`文件访问记录: ${log.accessType} ${log.fileName}`)

    // 限制内存中的日志数量
    if (this.accessLogs.length > 10000) {
      this.accessLogs = this.accessLogs.slice(-5000)
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats(): Promise<StorageStats> {
    try {
      const uploadDir = this.configService.get<string>('UPLOAD_DIR', 'uploads')
      const stats = await this.calculateDirectoryStats(uploadDir)

      // 获取系统磁盘信息
      const diskStats = await this.getDiskStats(uploadDir)

      return {
        totalFiles: stats.fileCount,
        totalSize: stats.totalSize,
        usedSpace: diskStats.used,
        availableSpace: diskStats.available,
        usagePercentage: (diskStats.used / diskStats.total) * 100,
        categoryBreakdown: stats.categoryBreakdown,
      }
    } catch (error) {
      this.logger.error('获取存储统计失败', error)
      throw error
    }
  }

  /**
   * 获取性能指标
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const now = Date.now()
    const recentLogs = this.accessLogs.filter(
      log => now - log.timestamp.getTime() < 60000 // 最近1分钟
    )

    const responseTimes = recentLogs.filter(log => log.responseTime).map(log => log.responseTime!)

    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0

    const requestsPerSecond = recentLogs.length / 60

    const errorLogs = recentLogs.filter(log => log.statusCode && log.statusCode >= 400)
    const errorRate = recentLogs.length > 0 ? errorLogs.length / recentLogs.length : 0

    const memoryUsage = process.memoryUsage()
    const totalMemory = os.totalmem()

    return {
      averageResponseTime,
      requestsPerSecond,
      errorRate,
      throughput: this.calculateThroughput(),
      activeConnections: 0, // 需要从HTTP服务器获取
      memoryUsage: {
        used: memoryUsage.heapUsed,
        total: totalMemory,
        percentage: (memoryUsage.heapUsed / totalMemory) * 100,
      },
      cpuUsage: await this.getCpuUsage(),
    }
  }

  /**
   * 获取文件热度统计
   */
  async getFilePopularityStats(limit = 10): Promise<FilePopularityStats[]> {
    const fileAccessCounts = new Map<
      string,
      {
        count: number
        downloadCount: number
        lastAccessed: Date
        fileName: string
        category: string
      }
    >()

    // 统计访问次数
    for (const log of this.accessLogs) {
      const existing = fileAccessCounts.get(log.fileId) || {
        count: 0,
        downloadCount: 0,
        lastAccessed: new Date(0),
        fileName: log.fileName,
        category: 'unknown',
      }

      existing.count++
      if (log.accessType === 'download') {
        existing.downloadCount++
      }
      if (log.timestamp > existing.lastAccessed) {
        existing.lastAccessed = log.timestamp
      }

      fileAccessCounts.set(log.fileId, existing)
    }

    // 转换为数组并排序
    const popularFiles: FilePopularityStats[] = Array.from(fileAccessCounts.entries())
      .map(([fileId, stats]) => ({
        fileId,
        fileName: stats.fileName,
        accessCount: stats.count,
        downloadCount: stats.downloadCount,
        lastAccessed: stats.lastAccessed,
        totalSize: 0, // 需要从文件系统获取
        category: stats.category,
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit)

    return popularFiles
  }

  /**
   * 获取访问模式分析
   */
  async getAccessPatterns(): Promise<AccessPattern[]> {
    const patterns = new Map<string, AccessPattern>()

    for (const log of this.accessLogs) {
      const date = new Date(log.timestamp)
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`

      const existing = patterns.get(key) || {
        hour: date.getHours(),
        day: date.getDate(),
        month: date.getMonth(),
        year: date.getFullYear(),
        accessCount: 0,
        downloadCount: 0,
        uploadCount: 0,
      }

      existing.accessCount++
      if (log.accessType === 'download') {
        existing.downloadCount++
      } else if (log.accessType === 'upload') {
        existing.uploadCount++
      }

      patterns.set(key, existing)
    }

    return Array.from(patterns.values()).sort(
      (a, b) =>
        new Date(a.year, a.month, a.day, a.hour).getTime() -
        new Date(b.year, b.month, b.day, b.hour).getTime()
    )
  }

  /**
   * 获取错误统计
   */
  async getErrorStats(): Promise<ErrorStats[]> {
    const errorCounts = new Map<
      string,
      {
        count: number
        lastOccurred: Date
        examples: Array<{ message: string; timestamp: Date; context?: any }>
      }
    >()

    const errorLogs = this.accessLogs.filter(log => log.errorMessage)

    for (const log of errorLogs) {
      const errorType = this.categorizeError(log.errorMessage!)
      const existing = errorCounts.get(errorType) || {
        count: 0,
        lastOccurred: new Date(0),
        examples: [],
      }

      existing.count++
      if (log.timestamp > existing.lastOccurred) {
        existing.lastOccurred = log.timestamp
      }

      if (existing.examples.length < 5) {
        existing.examples.push({
          message: log.errorMessage!,
          timestamp: log.timestamp,
        })
      }

      errorCounts.set(errorType, existing)
    }

    const totalErrors = errorLogs.length

    return Array.from(errorCounts.entries()).map(([errorType, stats]) => ({
      errorType,
      count: stats.count,
      percentage: totalErrors > 0 ? (stats.count / totalErrors) * 100 : 0,
      lastOccurred: stats.lastOccurred,
      examples: stats.examples,
    }))
  }

  /**
   * 获取系统健康状态
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const uptime = Date.now() - this.startTime
    const services = await this.checkServices()
    const recentAlerts = this.alerts.filter(
      alert => Date.now() - alert.timestamp.getTime() < 24 * 60 * 60 * 1000 // 24小时内
    )

    let status: 'healthy' | 'warning' | 'critical' = 'healthy'

    if (services.some(service => service.status === 'down')) {
      status = 'critical'
    } else if (
      services.some(service => service.status === 'degraded') ||
      recentAlerts.some(alert => alert.severity === 'high' || alert.severity === 'critical')
    ) {
      status = 'warning'
    }

    return {
      status,
      uptime,
      lastCheck: new Date(),
      services,
      alerts: recentAlerts.map(alert => ({
        level: alert.severity as 'info' | 'warning' | 'error' | 'critical',
        message: alert.message,
        timestamp: alert.timestamp,
        resolved: alert.resolved,
      })),
    }
  }

  /**
   * 生成监控报告
   */
  async generateReport(startDate: Date, endDate: Date): Promise<MonitoringReport> {
    const filteredLogs = this.accessLogs.filter(
      log => log.timestamp >= startDate && log.timestamp <= endDate
    )

    // 临时保存原始日志，用过滤后的日志计算统计
    const originalLogs = this.accessLogs
    this.accessLogs = filteredLogs

    try {
      const [
        storageStats,
        performanceMetrics,
        popularFiles,
        accessPatterns,
        errorStats,
        systemHealth,
      ] = await Promise.all([
        this.getStorageStats(),
        this.getPerformanceMetrics(),
        this.getFilePopularityStats(),
        this.getAccessPatterns(),
        this.getErrorStats(),
        this.getSystemHealth(),
      ])

      return {
        period: { start: startDate, end: endDate },
        storageStats,
        performanceMetrics,
        popularFiles,
        accessPatterns,
        errorStats,
        systemHealth,
      }
    } finally {
      // 恢复原始日志
      this.accessLogs = originalLogs
    }
  }

  /**
   * 添加告警规则
   */
  async addAlertRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule> {
    const alertRule: AlertRule = {
      id: uuidv4(),
      ...rule,
    }

    this.alertRules.push(alertRule)
    this.logger.log(`添加告警规则: ${rule.name}`)

    return alertRule
  }

  /**
   * 获取所有告警规则
   */
  async getAlertRules(): Promise<AlertRule[]> {
    return [...this.alertRules]
  }

  /**
   * 获取活跃告警
   */
  async getActiveAlerts(): Promise<Alert[]> {
    return this.alerts.filter(alert => !alert.resolved)
  }

  /**
   * 定时检查告警
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkAlerts(): Promise<void> {
    if (!this.config.enablePerformanceMonitoring) return

    try {
      const metrics = await this.getPerformanceMetrics()
      const storageStats = await this.getStorageStats()

      for (const rule of this.alertRules.filter(r => r.enabled)) {
        await this.evaluateAlertRule(rule, { metrics, storageStats })
      }
    } catch (error) {
      this.logger.error('告警检查失败', error)
    }
  }

  /**
   * 定时清理旧数据
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldData(): Promise<void> {
    const retentionTime = this.config.logRetentionDays * 24 * 60 * 60 * 1000
    const cutoffTime = Date.now() - retentionTime

    // 清理访问日志
    this.accessLogs = this.accessLogs.filter(log => log.timestamp.getTime() > cutoffTime)

    // 清理已解决的告警
    this.alerts = this.alerts.filter(
      alert => !alert.resolved || alert.timestamp.getTime() > cutoffTime
    )

    this.logger.log('旧数据清理完成')
  }

  /**
   * 计算目录统计信息
   */
  private async calculateDirectoryStats(dirPath: string): Promise<{
    fileCount: number
    totalSize: number
    categoryBreakdown: Record<string, { count: number; size: number; percentage: number }>
  }> {
    const stats = {
      fileCount: 0,
      totalSize: 0,
      categoryBreakdown: {} as Record<string, { count: number; size: number; percentage: number }>,
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name)

        if (entry.isDirectory()) {
          const subStats = await this.calculateDirectoryStats(fullPath)
          stats.fileCount += subStats.fileCount
          stats.totalSize += subStats.totalSize

          // 合并分类统计
          for (const [category, categoryStats] of Object.entries(subStats.categoryBreakdown)) {
            if (!stats.categoryBreakdown[category]) {
              stats.categoryBreakdown[category] = { count: 0, size: 0, percentage: 0 }
            }
            stats.categoryBreakdown[category].count += categoryStats.count
            stats.categoryBreakdown[category].size += categoryStats.size
          }
        } else if (entry.isFile()) {
          const fileStat = await fs.stat(fullPath)
          stats.fileCount++
          stats.totalSize += fileStat.size

          // 根据目录名确定分类
          const category = dirPath.split('/').pop() || 'unknown'
          if (!stats.categoryBreakdown[category]) {
            stats.categoryBreakdown[category] = { count: 0, size: 0, percentage: 0 }
          }
          stats.categoryBreakdown[category].count++
          stats.categoryBreakdown[category].size += fileStat.size
        }
      }
    } catch (error) {
      this.logger.warn(`无法读取目录: ${dirPath}`, error)
    }

    // 计算百分比
    for (const category of Object.keys(stats.categoryBreakdown)) {
      stats.categoryBreakdown[category].percentage =
        stats.totalSize > 0 ? (stats.categoryBreakdown[category].size / stats.totalSize) * 100 : 0
    }

    return stats
  }

  /**
   * 获取磁盘统计信息
   */
  private async getDiskStats(
    path: string
  ): Promise<{ total: number; used: number; available: number }> {
    try {
      const stats = await fs.statfs(path)
      const total = stats.blocks * stats.bsize
      const available = stats.bavail * stats.bsize
      const used = total - available

      return { total, used, available }
    } catch (error) {
      // 如果statfs不可用，返回默认值
      return { total: 0, used: 0, available: 0 }
    }
  }

  /**
   * 计算吞吐量
   */
  private calculateThroughput(): number {
    const now = Date.now()
    const recentLogs = this.accessLogs.filter(
      log => now - log.timestamp.getTime() < 60000 // 最近1分钟
    )

    // 简化计算，实际项目中需要更精确的实现
    return recentLogs.length * 1024 // 假设平均每个请求1KB
  }

  /**
   * 获取CPU使用率
   */
  private async getCpuUsage(): Promise<number> {
    return new Promise(resolve => {
      const startUsage = process.cpuUsage()

      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage)
        const totalUsage = endUsage.user + endUsage.system
        const percentage = (totalUsage / 1000000) * 100 // 转换为百分比
        resolve(Math.min(percentage, 100))
      }, 100)
    })
  }

  /**
   * 检查服务状态
   */
  private async checkServices(): Promise<
    Array<{
      name: string
      status: 'up' | 'down' | 'degraded'
      responseTime?: number
      lastCheck: Date
      errorMessage?: string
    }>
  > {
    const services = [
      { name: 'File Service', check: () => Promise.resolve(true) },
      { name: 'Cache Service', check: () => this.checkCacheService() },
      { name: 'CDN Service', check: () => this.checkCDNService() },
    ]

    const results = []

    for (const service of services) {
      const startTime = Date.now()
      try {
        const isUp = await service.check()
        const responseTime = Date.now() - startTime

        results.push({
          name: service.name,
          status: isUp ? (responseTime > 5000 ? 'degraded' : 'up') : 'down',
          responseTime,
          lastCheck: new Date(),
        })
      } catch (error) {
        results.push({
          name: service.name,
          status: 'down' as const,
          lastCheck: new Date(),
          errorMessage: error.message,
        })
      }
    }

    return results
  }

  /**
   * 检查缓存服务
   */
  private async checkCacheService(): Promise<boolean> {
    // 简化实现，实际项目中需要真正的健康检查
    return true
  }

  /**
   * 检查CDN服务
   */
  private async checkCDNService(): Promise<boolean> {
    // 简化实现，实际项目中需要真正的健康检查
    return true
  }

  /**
   * 分类错误类型
   */
  private categorizeError(errorMessage: string): string {
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      return 'Not Found'
    } else if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
      return 'Access Denied'
    } else if (errorMessage.includes('500') || errorMessage.includes('internal')) {
      return 'Internal Server Error'
    } else if (errorMessage.includes('timeout')) {
      return 'Timeout'
    } else {
      return 'Other'
    }
  }

  /**
   * 评估告警规则
   */
  private async evaluateAlertRule(
    rule: AlertRule,
    context: { metrics: PerformanceMetrics; storageStats: StorageStats }
  ): Promise<void> {
    let value: number

    // 根据指标类型获取值
    switch (rule.metric) {
      case 'response_time':
        value = context.metrics.averageResponseTime
        break
      case 'error_rate':
        value = context.metrics.errorRate * 100
        break
      case 'memory_usage':
        value = context.metrics.memoryUsage.percentage
        break
      case 'cpu_usage':
        value = context.metrics.cpuUsage
        break
      case 'storage_usage':
        value = context.storageStats.usagePercentage
        break
      default:
        return
    }

    // 评估条件
    let triggered = false
    switch (rule.operator) {
      case '>':
        triggered = value > rule.threshold
        break
      case '<':
        triggered = value < rule.threshold
        break
      case '>=':
        triggered = value >= rule.threshold
        break
      case '<=':
        triggered = value <= rule.threshold
        break
      case '==':
        triggered = value === rule.threshold
        break
      case '!=':
        triggered = value !== rule.threshold
        break
    }

    if (triggered) {
      await this.createAlert(rule, value)
    }
  }

  /**
   * 创建告警
   */
  private async createAlert(rule: AlertRule, value: number): Promise<void> {
    // 检查是否已有未解决的相同告警
    const existingAlert = this.alerts.find(alert => alert.ruleId === rule.id && !alert.resolved)

    if (existingAlert) {
      return // 避免重复告警
    }

    const alert: Alert = {
      id: uuidv4(),
      ruleId: rule.id,
      ruleName: rule.name,
      message: `${rule.description}: 当前值 ${value}, 阈值 ${rule.threshold}`,
      severity: rule.severity,
      timestamp: new Date(),
      resolved: false,
      metadata: { value, threshold: rule.threshold },
    }

    this.alerts.push(alert)
    this.logger.warn(`触发告警: ${alert.message}`)

    // 执行告警动作
    for (const action of rule.actions) {
      await this.executeAlertAction(action, alert)
    }
  }

  /**
   * 执行告警动作
   */
  private async executeAlertAction(action: any, alert: Alert): Promise<void> {
    switch (action.type) {
      case 'log':
        this.logger.warn(`告警: ${alert.message}`)
        break
      case 'email':
        // 发送邮件通知
        this.logger.log(`发送邮件告警: ${alert.message}`)
        break
      case 'webhook':
        // 发送Webhook通知
        this.logger.log(`发送Webhook告警: ${alert.message}`)
        break
    }
  }

  /**
   * 初始化默认告警规则
   */
  private initializeDefaultAlertRules(): void {
    const defaultRules: Omit<AlertRule, 'id'>[] = [
      {
        name: '高响应时间',
        description: '平均响应时间过高',
        metric: 'response_time',
        operator: '>',
        threshold: 5000,
        enabled: true,
        severity: 'high',
        actions: [{ type: 'log', config: {} }],
      },
      {
        name: '高错误率',
        description: '错误率过高',
        metric: 'error_rate',
        operator: '>',
        threshold: 5,
        enabled: true,
        severity: 'high',
        actions: [{ type: 'log', config: {} }],
      },
      {
        name: '存储空间不足',
        description: '存储空间使用率过高',
        metric: 'storage_usage',
        operator: '>',
        threshold: 90,
        enabled: true,
        severity: 'critical',
        actions: [{ type: 'log', config: {} }],
      },
    ]

    for (const rule of defaultRules) {
      this.addAlertRule(rule)
    }
  }

  /**
   * 加载监控配置
   */
  private loadConfig(): MonitoringConfig {
    return {
      enableAccessLogging: this.configService.get<boolean>('MONITORING_ACCESS_LOGGING', true),
      enablePerformanceMonitoring: this.configService.get<boolean>('MONITORING_PERFORMANCE', true),
      enableStorageMonitoring: this.configService.get<boolean>('MONITORING_STORAGE', true),
      logRetentionDays: this.configService.get<number>('MONITORING_LOG_RETENTION_DAYS', 30),
      metricsRetentionDays: this.configService.get<number>('MONITORING_METRICS_RETENTION_DAYS', 90),
      alertCheckInterval: this.configService.get<number>('MONITORING_ALERT_CHECK_INTERVAL', 60),
      performanceCheckInterval: this.configService.get<number>(
        'MONITORING_PERFORMANCE_CHECK_INTERVAL',
        30
      ),
      storageCheckInterval: this.configService.get<number>(
        'MONITORING_STORAGE_CHECK_INTERVAL',
        300
      ),
    }
  }
}
