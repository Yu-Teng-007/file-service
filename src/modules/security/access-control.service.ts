import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InsufficientPermissionException } from '../../common/exceptions/custom.exceptions'
import { FileAccessLevel, FileCategory } from '../../types/file.types'

export interface AccessControlRule {
  id: string
  name: string
  description: string
  condition: (context: AccessContext) => boolean
  action: 'allow' | 'deny'
  priority: number
}

export interface AccessContext {
  userId?: string
  userRole?: string
  ipAddress: string
  userAgent: string
  fileId?: string
  fileName?: string
  fileCategory?: FileCategory
  fileAccessLevel?: FileAccessLevel
  operation: 'read' | 'write' | 'delete' | 'upload' | 'download'
  timestamp: Date
  requestHeaders: Record<string, string>
}

export interface AccessLog {
  id: string
  userId?: string
  ipAddress: string
  operation: string
  resource: string
  result: 'allowed' | 'denied'
  reason?: string
  timestamp: Date
  userAgent: string
}

@Injectable()
export class AccessControlService {
  private readonly logger = new Logger(AccessControlService.name)
  private readonly accessRules: Map<string, AccessControlRule> = new Map()
  private readonly accessLogs: AccessLog[] = []
  private readonly ipWhitelist: Set<string> = new Set()
  private readonly ipBlacklist: Set<string> = new Set()
  private readonly suspiciousIPs: Map<string, { count: number; lastSeen: Date }> = new Map()

  constructor(private readonly configService: ConfigService) {
    this.initializeDefaultRules()
    this.loadIPLists()
  }

  /**
   * 初始化默认访问控制规则
   */
  private initializeDefaultRules(): void {
    // 规则1: 阻止黑名单IP
    this.addRule({
      id: 'block-blacklisted-ips',
      name: '阻止黑名单IP',
      description: '阻止黑名单中的IP地址访问',
      condition: (context) => this.ipBlacklist.has(context.ipAddress),
      action: 'deny',
      priority: 1000,
    })

    // 规则2: 允许白名单IP
    this.addRule({
      id: 'allow-whitelisted-ips',
      name: '允许白名单IP',
      description: '允许白名单中的IP地址访问',
      condition: (context) => this.ipWhitelist.has(context.ipAddress),
      action: 'allow',
      priority: 900,
    })

    // 规则3: 阻止可疑IP
    this.addRule({
      id: 'block-suspicious-ips',
      name: '阻止可疑IP',
      description: '阻止频繁失败访问的IP地址',
      condition: (context) => {
        const suspicious = this.suspiciousIPs.get(context.ipAddress)
        return suspicious && suspicious.count >= 10
      },
      action: 'deny',
      priority: 800,
    })

    // 规则4: 私有文件访问控制
    this.addRule({
      id: 'private-file-access',
      name: '私有文件访问控制',
      description: '只有授权用户可以访问私有文件',
      condition: (context) => 
        context.fileAccessLevel === FileAccessLevel.PRIVATE && 
        context.operation === 'read' && 
        !context.userId,
      action: 'deny',
      priority: 700,
    })

    // 规则5: 管理员操作权限
    this.addRule({
      id: 'admin-operations',
      name: '管理员操作权限',
      description: '只有管理员可以执行删除操作',
      condition: (context) => 
        context.operation === 'delete' && 
        context.userRole !== 'admin',
      action: 'deny',
      priority: 600,
    })

    // 规则6: 文件大小限制
    this.addRule({
      id: 'file-size-limit',
      name: '文件大小限制',
      description: '限制单个文件的最大大小',
      condition: (context) => {
        if (context.operation !== 'upload') return false
        // 这里应该检查文件大小，但需要从请求中获取
        return false
      },
      action: 'deny',
      priority: 500,
    })

    // 规则7: 时间窗口限制
    this.addRule({
      id: 'time-window-restriction',
      name: '时间窗口限制',
      description: '在特定时间窗口内限制访问',
      condition: (context) => {
        const hour = context.timestamp.getHours()
        // 例如：凌晨2-6点限制上传操作
        return context.operation === 'upload' && hour >= 2 && hour <= 6
      },
      action: 'deny',
      priority: 400,
    })

    // 规则8: 用户代理检查
    this.addRule({
      id: 'user-agent-check',
      name: '用户代理检查',
      description: '阻止可疑的用户代理',
      condition: (context) => {
        const suspiciousAgents = ['bot', 'crawler', 'spider', 'scraper']
        const userAgent = context.userAgent.toLowerCase()
        return suspiciousAgents.some(agent => userAgent.includes(agent))
      },
      action: 'deny',
      priority: 300,
    })
  }

  /**
   * 加载IP白名单和黑名单
   */
  private loadIPLists(): void {
    // 从配置中加载IP列表
    const whitelist = this.configService.get<string>('SECURITY_IP_WHITELIST')?.split(',') || []
    const blacklist = this.configService.get<string>('SECURITY_IP_BLACKLIST')?.split(',') || []

    whitelist.forEach(ip => this.ipWhitelist.add(ip.trim()))
    blacklist.forEach(ip => this.ipBlacklist.add(ip.trim()))

    // 添加默认的本地IP到白名单
    this.ipWhitelist.add('127.0.0.1')
    this.ipWhitelist.add('::1')
    this.ipWhitelist.add('localhost')

    this.logger.log(`已加载 ${this.ipWhitelist.size} 个白名单IP，${this.ipBlacklist.size} 个黑名单IP`)
  }

  /**
   * 检查访问权限
   */
  async checkAccess(context: AccessContext): Promise<boolean> {
    try {
      // 按优先级排序规则
      const sortedRules = Array.from(this.accessRules.values())
        .sort((a, b) => b.priority - a.priority)

      let result = true // 默认允许
      let appliedRule: AccessControlRule | null = null

      // 应用规则
      for (const rule of sortedRules) {
        if (rule.condition(context)) {
          result = rule.action === 'allow'
          appliedRule = rule
          break
        }
      }

      // 记录访问日志
      await this.logAccess({
        id: this.generateId(),
        userId: context.userId,
        ipAddress: context.ipAddress,
        operation: context.operation,
        resource: context.fileName || context.fileId || 'unknown',
        result: result ? 'allowed' : 'denied',
        reason: appliedRule?.name,
        timestamp: new Date(),
        userAgent: context.userAgent,
      })

      // 如果访问被拒绝，更新可疑IP计数
      if (!result) {
        this.updateSuspiciousIP(context.ipAddress)
      }

      if (!result && appliedRule) {
        this.logger.warn(
          `访问被拒绝: ${context.operation} ${context.fileName || context.fileId} ` +
          `来自 ${context.ipAddress}, 规则: ${appliedRule.name}`
        )
      }

      return result

    } catch (error) {
      this.logger.error('访问控制检查失败', error)
      // 发生错误时默认拒绝访问
      return false
    }
  }

  /**
   * 验证文件访问权限
   */
  async validateFileAccess(
    fileId: string,
    fileName: string,
    fileAccessLevel: FileAccessLevel,
    fileCategory: FileCategory,
    operation: 'read' | 'write' | 'delete',
    context: Partial<AccessContext>
  ): Promise<void> {
    const accessContext: AccessContext = {
      fileId,
      fileName,
      fileAccessLevel,
      fileCategory,
      operation,
      timestamp: new Date(),
      ipAddress: context.ipAddress || 'unknown',
      userAgent: context.userAgent || 'unknown',
      userId: context.userId,
      userRole: context.userRole,
      requestHeaders: context.requestHeaders || {},
    }

    const hasAccess = await this.checkAccess(accessContext)

    if (!hasAccess) {
      throw new InsufficientPermissionException(
        operation,
        `${fileCategory}/${fileName}`,
        { fileId, accessLevel: fileAccessLevel }
      )
    }
  }

  /**
   * 添加访问控制规则
   */
  addRule(rule: AccessControlRule): void {
    this.accessRules.set(rule.id, rule)
    this.logger.debug(`已添加访问控制规则: ${rule.name}`)
  }

  /**
   * 移除访问控制规则
   */
  removeRule(ruleId: string): boolean {
    const removed = this.accessRules.delete(ruleId)
    if (removed) {
      this.logger.debug(`已移除访问控制规则: ${ruleId}`)
    }
    return removed
  }

  /**
   * 添加IP到黑名单
   */
  addToBlacklist(ipAddress: string): void {
    this.ipBlacklist.add(ipAddress)
    this.logger.warn(`已将IP ${ipAddress} 添加到黑名单`)
  }

  /**
   * 从黑名单移除IP
   */
  removeFromBlacklist(ipAddress: string): boolean {
    const removed = this.ipBlacklist.delete(ipAddress)
    if (removed) {
      this.logger.log(`已将IP ${ipAddress} 从黑名单移除`)
    }
    return removed
  }

  /**
   * 添加IP到白名单
   */
  addToWhitelist(ipAddress: string): void {
    this.ipWhitelist.add(ipAddress)
    this.logger.log(`已将IP ${ipAddress} 添加到白名单`)
  }

  /**
   * 从白名单移除IP
   */
  removeFromWhitelist(ipAddress: string): boolean {
    const removed = this.ipWhitelist.delete(ipAddress)
    if (removed) {
      this.logger.log(`已将IP ${ipAddress} 从白名单移除`)
    }
    return removed
  }

  /**
   * 获取访问日志
   */
  getAccessLogs(limit: number = 100): AccessLog[] {
    return this.accessLogs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  /**
   * 获取可疑IP列表
   */
  getSuspiciousIPs(): Array<{ ip: string; count: number; lastSeen: Date }> {
    return Array.from(this.suspiciousIPs.entries())
      .map(([ip, data]) => ({ ip, ...data }))
      .sort((a, b) => b.count - a.count)
  }

  /**
   * 清理过期的可疑IP记录
   */
  cleanupSuspiciousIPs(): void {
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24小时

    for (const [ip, data] of this.suspiciousIPs.entries()) {
      if (now - data.lastSeen.getTime() > maxAge) {
        this.suspiciousIPs.delete(ip)
      }
    }
  }

  /**
   * 记录访问日志
   */
  private async logAccess(log: AccessLog): Promise<void> {
    this.accessLogs.push(log)

    // 限制内存中的日志数量
    if (this.accessLogs.length > 10000) {
      this.accessLogs.splice(0, 5000) // 保留最新的5000条
    }
  }

  /**
   * 更新可疑IP计数
   */
  private updateSuspiciousIP(ipAddress: string): void {
    const existing = this.suspiciousIPs.get(ipAddress) || { count: 0, lastSeen: new Date() }
    existing.count++
    existing.lastSeen = new Date()
    this.suspiciousIPs.set(ipAddress, existing)
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}
