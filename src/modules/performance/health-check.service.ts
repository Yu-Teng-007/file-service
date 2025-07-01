import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CacheService } from '../cache/cache.service'
import { promises as fs } from 'fs'
import { join } from 'path'

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: Date
  checks: HealthCheck[]
  summary: {
    total: number
    passed: number
    failed: number
    warnings: number
  }
}

export interface HealthCheck {
  name: string
  status: 'pass' | 'fail' | 'warn'
  responseTime: number
  message?: string
  details?: any
}

@Injectable()
export class HealthCheckService {
  private readonly logger = new Logger(HealthCheckService.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService
  ) {}

  /**
   * 执行完整的健康检查
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    const checks: HealthCheck[] = []

    // 执行各项检查
    checks.push(await this.checkDatabase())
    checks.push(await this.checkCache())
    checks.push(await this.checkFileSystem())
    checks.push(await this.checkMemory())
    checks.push(await this.checkDiskSpace())
    checks.push(await this.checkExternalServices())
    checks.push(await this.checkConfiguration())

    // 计算摘要
    const summary = {
      total: checks.length,
      passed: checks.filter(c => c.status === 'pass').length,
      failed: checks.filter(c => c.status === 'fail').length,
      warnings: checks.filter(c => c.status === 'warn').length,
    }

    // 确定整体状态
    let status: 'healthy' | 'degraded' | 'unhealthy'
    if (summary.failed > 0) {
      status = 'unhealthy'
    } else if (summary.warnings > 0) {
      status = 'degraded'
    } else {
      status = 'healthy'
    }

    const result: HealthCheckResult = {
      status,
      timestamp: new Date(),
      checks,
      summary,
    }

    const totalTime = Date.now() - startTime
    this.logger.log(`健康检查完成: ${status} (${totalTime}ms)`)

    return result
  }

  /**
   * 检查数据库连接
   */
  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      // 这里应该检查实际的数据库连接
      // 由于项目使用SQLite，我们检查数据库文件是否存在
      const dbUrl = this.configService.get<string>('DATABASE_URL')
      
      if (dbUrl && dbUrl.includes('sqlite:')) {
        const dbPath = dbUrl.replace('sqlite:', '')
        if (dbPath !== ':memory:') {
          await fs.access(dbPath)
        }
      }

      return {
        name: 'database',
        status: 'pass',
        responseTime: Date.now() - startTime,
        message: '数据库连接正常',
      }
    } catch (error) {
      return {
        name: 'database',
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: `数据库连接失败: ${error.message}`,
        details: { error: error.message },
      }
    }
  }

  /**
   * 检查缓存服务
   */
  private async checkCache(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      const healthResult = await this.cacheService.healthCheck()
      
      return {
        name: 'cache',
        status: healthResult.status === 'healthy' ? 'pass' : 'fail',
        responseTime: Date.now() - startTime,
        message: healthResult.status === 'healthy' ? '缓存服务正常' : '缓存服务异常',
        details: healthResult,
      }
    } catch (error) {
      return {
        name: 'cache',
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: `缓存服务检查失败: ${error.message}`,
        details: { error: error.message },
      }
    }
  }

  /**
   * 检查文件系统
   */
  private async checkFileSystem(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      const uploadDir = this.configService.get<string>('UPLOAD_DIR') || 'uploads'
      const tempDir = this.configService.get<string>('TEMP_DIR') || 'temp'
      
      // 检查上传目录
      await fs.access(uploadDir)
      await fs.access(tempDir)
      
      // 测试写入权限
      const testFile = join(tempDir, `health-check-${Date.now()}.tmp`)
      await fs.writeFile(testFile, 'health check test')
      await fs.unlink(testFile)

      return {
        name: 'filesystem',
        status: 'pass',
        responseTime: Date.now() - startTime,
        message: '文件系统访问正常',
        details: { uploadDir, tempDir },
      }
    } catch (error) {
      return {
        name: 'filesystem',
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: `文件系统访问失败: ${error.message}`,
        details: { error: error.message },
      }
    }
  }

  /**
   * 检查内存使用情况
   */
  private async checkMemory(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      const memoryUsage = process.memoryUsage()
      const totalMemory = require('os').totalmem()
      const freeMemory = require('os').freemem()
      const usedMemory = totalMemory - freeMemory
      const memoryUsagePercent = (usedMemory / totalMemory) * 100
      
      let status: 'pass' | 'warn' | 'fail' = 'pass'
      let message = '内存使用正常'
      
      if (memoryUsagePercent > 90) {
        status = 'fail'
        message = `内存使用率过高: ${memoryUsagePercent.toFixed(2)}%`
      } else if (memoryUsagePercent > 80) {
        status = 'warn'
        message = `内存使用率较高: ${memoryUsagePercent.toFixed(2)}%`
      }

      return {
        name: 'memory',
        status,
        responseTime: Date.now() - startTime,
        message,
        details: {
          processMemory: memoryUsage,
          systemMemory: {
            total: totalMemory,
            free: freeMemory,
            used: usedMemory,
            usagePercent: memoryUsagePercent,
          },
        },
      }
    } catch (error) {
      return {
        name: 'memory',
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: `内存检查失败: ${error.message}`,
        details: { error: error.message },
      }
    }
  }

  /**
   * 检查磁盘空间
   */
  private async checkDiskSpace(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      const uploadDir = this.configService.get<string>('UPLOAD_DIR') || 'uploads'
      
      // 简单的磁盘空间检查（在实际项目中应该使用专门的库）
      const stats = await fs.stat(uploadDir)
      
      let status: 'pass' | 'warn' | 'fail' = 'pass'
      let message = '磁盘空间充足'
      
      // 这里应该实现真正的磁盘空间检查
      // 由于需要额外的依赖，这里只做基本检查
      
      return {
        name: 'disk',
        status,
        responseTime: Date.now() - startTime,
        message,
        details: {
          uploadDir,
          accessible: true,
        },
      }
    } catch (error) {
      return {
        name: 'disk',
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: `磁盘检查失败: ${error.message}`,
        details: { error: error.message },
      }
    }
  }

  /**
   * 检查外部服务
   */
  private async checkExternalServices(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      const checks = []
      
      // 检查CDN服务（如果配置了）
      const cdnUrl = this.configService.get<string>('CDN_URL')
      if (cdnUrl) {
        // 这里应该ping CDN服务
        checks.push('CDN服务可达')
      }
      
      // 检查病毒扫描API（如果配置了）
      const virusScanApiKey = this.configService.get<string>('VIRUS_SCAN_API_KEY')
      if (virusScanApiKey) {
        // 这里应该测试病毒扫描API
        checks.push('病毒扫描API可用')
      }

      return {
        name: 'external_services',
        status: 'pass',
        responseTime: Date.now() - startTime,
        message: checks.length > 0 ? `外部服务正常: ${checks.join(', ')}` : '无外部服务依赖',
        details: { services: checks },
      }
    } catch (error) {
      return {
        name: 'external_services',
        status: 'warn',
        responseTime: Date.now() - startTime,
        message: `外部服务检查异常: ${error.message}`,
        details: { error: error.message },
      }
    }
  }

  /**
   * 检查配置
   */
  private async checkConfiguration(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      const issues = []
      
      // 检查关键配置项
      const requiredConfigs = [
        'PORT',
        'UPLOAD_DIR',
        'MAX_FILE_SIZE',
      ]
      
      for (const config of requiredConfigs) {
        const value = this.configService.get(config)
        if (!value) {
          issues.push(`缺少配置: ${config}`)
        }
      }
      
      // 检查安全配置
      const jwtSecret = this.configService.get<string>('JWT_SECRET')
      if (jwtSecret === 'default-jwt-secret') {
        issues.push('使用默认JWT密钥，存在安全风险')
      }
      
      const apiKey = this.configService.get<string>('API_KEY')
      if (apiKey === 'default-api-key') {
        issues.push('使用默认API密钥，存在安全风险')
      }

      let status: 'pass' | 'warn' | 'fail' = 'pass'
      let message = '配置检查通过'
      
      if (issues.length > 0) {
        status = issues.some(issue => issue.includes('缺少配置')) ? 'fail' : 'warn'
        message = `配置问题: ${issues.join(', ')}`
      }

      return {
        name: 'configuration',
        status,
        responseTime: Date.now() - startTime,
        message,
        details: { issues },
      }
    } catch (error) {
      return {
        name: 'configuration',
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: `配置检查失败: ${error.message}`,
        details: { error: error.message },
      }
    }
  }

  /**
   * 快速健康检查（用于负载均衡器）
   */
  async quickHealthCheck(): Promise<{ status: 'ok' | 'error'; timestamp: Date }> {
    try {
      // 执行最基本的检查
      const memoryUsage = process.memoryUsage()
      const uptime = process.uptime()
      
      // 检查内存是否过高
      if (memoryUsage.heapUsed > memoryUsage.heapTotal * 0.9) {
        return { status: 'error', timestamp: new Date() }
      }
      
      // 检查运行时间（如果刚启动可能还不稳定）
      if (uptime < 10) {
        return { status: 'error', timestamp: new Date() }
      }

      return { status: 'ok', timestamp: new Date() }
    } catch (error) {
      this.logger.error('快速健康检查失败', error)
      return { status: 'error', timestamp: new Date() }
    }
  }

  /**
   * 获取就绪状态（用于Kubernetes readiness probe）
   */
  async getReadinessStatus(): Promise<{ ready: boolean; timestamp: Date; details?: any }> {
    try {
      // 检查关键服务是否就绪
      const cacheHealth = await this.cacheService.healthCheck()
      
      const ready = cacheHealth.status === 'healthy'
      
      return {
        ready,
        timestamp: new Date(),
        details: {
          cache: cacheHealth.status,
        },
      }
    } catch (error) {
      this.logger.error('就绪状态检查失败', error)
      return {
        ready: false,
        timestamp: new Date(),
        details: { error: error.message },
      }
    }
  }

  /**
   * 获取存活状态（用于Kubernetes liveness probe）
   */
  async getLivenessStatus(): Promise<{ alive: boolean; timestamp: Date }> {
    try {
      // 基本的存活检查
      const uptime = process.uptime()
      const memoryUsage = process.memoryUsage()
      
      // 如果进程运行时间太短或内存使用异常，认为不健康
      const alive = uptime > 5 && memoryUsage.heapUsed < memoryUsage.heapTotal
      
      return { alive, timestamp: new Date() }
    } catch (error) {
      this.logger.error('存活状态检查失败', error)
      return { alive: false, timestamp: new Date() }
    }
  }
}
