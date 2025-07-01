import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ResourceLimitException } from '../../common/exceptions/custom.exceptions'

export interface RateLimitRule {
  id: string
  name: string
  windowMs: number // 时间窗口（毫秒）
  maxRequests: number // 最大请求数
  keyGenerator: (context: RateLimitContext) => string
  skipIf?: (context: RateLimitContext) => boolean
  onLimitReached?: (context: RateLimitContext) => void
}

export interface RateLimitContext {
  ipAddress: string
  userId?: string
  userAgent: string
  endpoint: string
  method: string
  timestamp: Date
}

export interface RateLimitInfo {
  limit: number
  remaining: number
  resetTime: Date
  windowMs: number
}

interface RequestRecord {
  count: number
  windowStart: number
  requests: number[]
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name)
  private readonly rules: Map<string, RateLimitRule> = new Map()
  private readonly requestCounts: Map<string, RequestRecord> = new Map()
  private readonly cleanupInterval: NodeJS.Timeout

  constructor(private readonly configService: ConfigService) {
    this.initializeDefaultRules()
    
    // 定期清理过期记录
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredRecords()
    }, 60000) // 每分钟清理一次
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
  }

  /**
   * 初始化默认限流规则
   */
  private initializeDefaultRules(): void {
    // 全局请求限制
    this.addRule({
      id: 'global-requests',
      name: '全局请求限制',
      windowMs: 60 * 1000, // 1分钟
      maxRequests: this.configService.get<number>('RATE_LIMIT_GLOBAL', 100),
      keyGenerator: (context) => `global:${context.ipAddress}`,
    })

    // 文件上传限制
    this.addRule({
      id: 'file-upload',
      name: '文件上传限制',
      windowMs: 60 * 1000, // 1分钟
      maxRequests: this.configService.get<number>('RATE_LIMIT_UPLOAD', 10),
      keyGenerator: (context) => `upload:${context.ipAddress}`,
      skipIf: (context) => !context.endpoint.includes('/upload'),
    })

    // 文件下载限制
    this.addRule({
      id: 'file-download',
      name: '文件下载限制',
      windowMs: 60 * 1000, // 1分钟
      maxRequests: this.configService.get<number>('RATE_LIMIT_DOWNLOAD', 50),
      keyGenerator: (context) => `download:${context.ipAddress}`,
      skipIf: (context) => !context.endpoint.includes('/download') && context.method !== 'GET',
    })

    // 用户级别限制
    this.addRule({
      id: 'user-requests',
      name: '用户请求限制',
      windowMs: 60 * 1000, // 1分钟
      maxRequests: this.configService.get<number>('RATE_LIMIT_USER', 200),
      keyGenerator: (context) => context.userId ? `user:${context.userId}` : `ip:${context.ipAddress}`,
    })

    // API密集操作限制
    this.addRule({
      id: 'api-intensive',
      name: 'API密集操作限制',
      windowMs: 5 * 60 * 1000, // 5分钟
      maxRequests: this.configService.get<number>('RATE_LIMIT_API_INTENSIVE', 100),
      keyGenerator: (context) => `api:${context.ipAddress}`,
      skipIf: (context) => !this.isIntensiveOperation(context.endpoint),
    })

    // 搜索操作限制
    this.addRule({
      id: 'search-requests',
      name: '搜索请求限制',
      windowMs: 60 * 1000, // 1分钟
      maxRequests: this.configService.get<number>('RATE_LIMIT_SEARCH', 30),
      keyGenerator: (context) => `search:${context.ipAddress}`,
      skipIf: (context) => !context.endpoint.includes('/search'),
    })

    // 批量操作限制
    this.addRule({
      id: 'batch-operations',
      name: '批量操作限制',
      windowMs: 5 * 60 * 1000, // 5分钟
      maxRequests: this.configService.get<number>('RATE_LIMIT_BATCH', 5),
      keyGenerator: (context) => `batch:${context.ipAddress}`,
      skipIf: (context) => !context.endpoint.includes('/batch'),
    })

    // 管理操作限制
    this.addRule({
      id: 'admin-operations',
      name: '管理操作限制',
      windowMs: 60 * 1000, // 1分钟
      maxRequests: this.configService.get<number>('RATE_LIMIT_ADMIN', 20),
      keyGenerator: (context) => `admin:${context.ipAddress}`,
      skipIf: (context) => !this.isAdminOperation(context.endpoint),
    })
  }

  /**
   * 检查请求是否超过限制
   */
  async checkLimit(context: RateLimitContext): Promise<RateLimitInfo | null> {
    const now = Date.now()

    for (const rule of this.rules.values()) {
      // 检查是否应该跳过此规则
      if (rule.skipIf && rule.skipIf(context)) {
        continue
      }

      const key = rule.keyGenerator(context)
      const record = this.getOrCreateRecord(key, rule.windowMs, now)

      // 检查是否超过限制
      if (record.count >= rule.maxRequests) {
        const resetTime = new Date(record.windowStart + rule.windowMs)
        
        this.logger.warn(
          `请求超过限制: ${rule.name}, IP: ${context.ipAddress}, ` +
          `当前: ${record.count}/${rule.maxRequests}, 重置时间: ${resetTime.toISOString()}`
        )

        // 调用限制回调
        if (rule.onLimitReached) {
          rule.onLimitReached(context)
        }

        throw new ResourceLimitException(
          rule.name,
          rule.maxRequests,
          record.count,
          {
            ruleId: rule.id,
            windowMs: rule.windowMs,
            resetTime,
            key,
          }
        )
      }

      // 记录请求
      record.count++
      record.requests.push(now)
    }

    // 返回最严格规则的限制信息
    const strictestRule = this.getStrictestRule(context)
    if (strictestRule) {
      const key = strictestRule.keyGenerator(context)
      const record = this.getOrCreateRecord(key, strictestRule.windowMs, now)
      
      return {
        limit: strictestRule.maxRequests,
        remaining: Math.max(0, strictestRule.maxRequests - record.count),
        resetTime: new Date(record.windowStart + strictestRule.windowMs),
        windowMs: strictestRule.windowMs,
      }
    }

    return null
  }

  /**
   * 获取或创建请求记录
   */
  private getOrCreateRecord(key: string, windowMs: number, now: number): RequestRecord {
    let record = this.requestCounts.get(key)

    if (!record || now - record.windowStart >= windowMs) {
      // 创建新的时间窗口
      record = {
        count: 0,
        windowStart: now,
        requests: [],
      }
      this.requestCounts.set(key, record)
    } else {
      // 清理过期的请求记录
      const windowStart = record.windowStart
      record.requests = record.requests.filter(timestamp => timestamp >= windowStart)
      record.count = record.requests.length
    }

    return record
  }

  /**
   * 获取最严格的规则
   */
  private getStrictestRule(context: RateLimitContext): RateLimitRule | null {
    let strictestRule: RateLimitRule | null = null
    let lowestRatio = Infinity

    for (const rule of this.rules.values()) {
      if (rule.skipIf && rule.skipIf(context)) {
        continue
      }

      const ratio = rule.maxRequests / (rule.windowMs / 1000) // 每秒请求数
      if (ratio < lowestRatio) {
        lowestRatio = ratio
        strictestRule = rule
      }
    }

    return strictestRule
  }

  /**
   * 添加限流规则
   */
  addRule(rule: RateLimitRule): void {
    this.rules.set(rule.id, rule)
    this.logger.debug(`已添加限流规则: ${rule.name}`)
  }

  /**
   * 移除限流规则
   */
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId)
    if (removed) {
      this.logger.debug(`已移除限流规则: ${ruleId}`)
    }
    return removed
  }

  /**
   * 获取当前限流状态
   */
  getCurrentStatus(context: RateLimitContext): Array<{
    rule: string
    current: number
    limit: number
    remaining: number
    resetTime: Date
  }> {
    const status: Array<{
      rule: string
      current: number
      limit: number
      remaining: number
      resetTime: Date
    }> = []

    const now = Date.now()

    for (const rule of this.rules.values()) {
      if (rule.skipIf && rule.skipIf(context)) {
        continue
      }

      const key = rule.keyGenerator(context)
      const record = this.getOrCreateRecord(key, rule.windowMs, now)

      status.push({
        rule: rule.name,
        current: record.count,
        limit: rule.maxRequests,
        remaining: Math.max(0, rule.maxRequests - record.count),
        resetTime: new Date(record.windowStart + rule.windowMs),
      })
    }

    return status
  }

  /**
   * 重置特定键的限制
   */
  resetLimit(key: string): boolean {
    return this.requestCounts.delete(key)
  }

  /**
   * 清理过期记录
   */
  private cleanupExpiredRecords(): void {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, record] of this.requestCounts.entries()) {
      // 如果记录超过最大窗口时间的2倍，则删除
      const maxWindowMs = Math.max(...Array.from(this.rules.values()).map(r => r.windowMs))
      if (now - record.windowStart > maxWindowMs * 2) {
        this.requestCounts.delete(key)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`清理了 ${cleanedCount} 个过期的限流记录`)
    }
  }

  /**
   * 判断是否为密集操作
   */
  private isIntensiveOperation(endpoint: string): boolean {
    const intensiveEndpoints = [
      '/batch',
      '/search',
      '/stats',
      '/process',
      '/convert',
      '/compress',
    ]
    return intensiveEndpoints.some(pattern => endpoint.includes(pattern))
  }

  /**
   * 判断是否为管理操作
   */
  private isAdminOperation(endpoint: string): boolean {
    const adminEndpoints = [
      '/admin',
      '/config',
      '/system',
      '/monitor',
      '/logs',
    ]
    return adminEndpoints.some(pattern => endpoint.includes(pattern))
  }

  /**
   * 获取限流统计信息
   */
  getStatistics(): {
    totalRules: number
    activeRecords: number
    topLimitedIPs: Array<{ ip: string; count: number }>
    ruleStats: Array<{ rule: string; activeKeys: number }>
  } {
    const ipCounts = new Map<string, number>()
    const ruleKeyCounts = new Map<string, number>()

    // 统计IP请求数和规则使用情况
    for (const [key, record] of this.requestCounts.entries()) {
      const parts = key.split(':')
      if (parts.length >= 2) {
        const ruleType = parts[0]
        const identifier = parts[1]

        // 统计IP
        if (identifier.includes('.') || identifier.includes(':')) { // IP地址
          ipCounts.set(identifier, (ipCounts.get(identifier) || 0) + record.count)
        }

        // 统计规则使用
        ruleKeyCounts.set(ruleType, (ruleKeyCounts.get(ruleType) || 0) + 1)
      }
    }

    // 获取请求最多的IP
    const topLimitedIPs = Array.from(ipCounts.entries())
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // 获取规则统计
    const ruleStats = Array.from(ruleKeyCounts.entries())
      .map(([rule, activeKeys]) => ({ rule, activeKeys }))

    return {
      totalRules: this.rules.size,
      activeRecords: this.requestCounts.size,
      topLimitedIPs,
      ruleStats,
    }
  }
}
