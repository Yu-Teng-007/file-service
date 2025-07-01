import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { promises as fs } from 'fs'
import { join } from 'path'
import { retryAsync, FILE_OPERATION_RETRY_OPTIONS } from '../utils/retry.util'

export interface RecoveryAction {
  id: string
  type: 'file_cleanup' | 'cache_clear' | 'service_restart' | 'custom'
  description: string
  execute: () => Promise<void>
  rollback?: () => Promise<void>
}

export interface RecoveryPlan {
  id: string
  name: string
  description: string
  actions: RecoveryAction[]
  conditions: (error: any) => boolean
}

@Injectable()
export class ErrorRecoveryService {
  private readonly logger = new Logger(ErrorRecoveryService.name)
  private readonly recoveryPlans: Map<string, RecoveryPlan> = new Map()
  private readonly executedActions: Map<string, Date> = new Map()

  constructor(private readonly configService: ConfigService) {
    this.initializeRecoveryPlans()
  }

  /**
   * 初始化恢复计划
   */
  private initializeRecoveryPlans(): void {
    // 文件上传失败恢复计划
    this.addRecoveryPlan({
      id: 'file-upload-failure',
      name: '文件上传失败恢复',
      description: '清理临时文件和缓存',
      conditions: (error) => 
        error.message?.includes('upload') || 
        error.code === 'FILE_PROCESSING_FAILED',
      actions: [
        {
          id: 'cleanup-temp-files',
          type: 'file_cleanup',
          description: '清理临时文件',
          execute: () => this.cleanupTempFiles(),
        },
        {
          id: 'clear-upload-cache',
          type: 'cache_clear',
          description: '清理上传缓存',
          execute: () => this.clearUploadCache(),
        },
      ],
    })

    // 存储空间不足恢复计划
    this.addRecoveryPlan({
      id: 'storage-full',
      name: '存储空间不足恢复',
      description: '清理旧文件和缓存',
      conditions: (error) => 
        error.code === 'ENOSPC' || 
        error.code === 'INSUFFICIENT_STORAGE',
      actions: [
        {
          id: 'cleanup-old-files',
          type: 'file_cleanup',
          description: '清理过期文件',
          execute: () => this.cleanupOldFiles(),
        },
        {
          id: 'compress-logs',
          type: 'file_cleanup',
          description: '压缩日志文件',
          execute: () => this.compressLogFiles(),
        },
      ],
    })

    // 缓存连接失败恢复计划
    this.addRecoveryPlan({
      id: 'cache-connection-failure',
      name: '缓存连接失败恢复',
      description: '重置缓存连接',
      conditions: (error) => 
        error.code === 'CACHE_CONNECTION_FAILED' ||
        error.message?.includes('Redis'),
      actions: [
        {
          id: 'reset-cache-connection',
          type: 'service_restart',
          description: '重置缓存连接',
          execute: () => this.resetCacheConnection(),
        },
      ],
    })

    // 文件权限错误恢复计划
    this.addRecoveryPlan({
      id: 'permission-error',
      name: '文件权限错误恢复',
      description: '修复文件权限',
      conditions: (error) => 
        error.code === 'EACCES' || 
        error.code === 'EPERM' ||
        error.code === 'INSUFFICIENT_PERMISSION',
      actions: [
        {
          id: 'fix-file-permissions',
          type: 'file_cleanup',
          description: '修复文件权限',
          execute: () => this.fixFilePermissions(),
        },
      ],
    })
  }

  /**
   * 添加恢复计划
   */
  addRecoveryPlan(plan: RecoveryPlan): void {
    this.recoveryPlans.set(plan.id, plan)
    this.logger.log(`已添加恢复计划: ${plan.name}`)
  }

  /**
   * 执行错误恢复
   */
  async executeRecovery(error: any): Promise<boolean> {
    this.logger.warn('开始执行错误恢复', error.message)

    const applicablePlans = Array.from(this.recoveryPlans.values())
      .filter(plan => plan.conditions(error))

    if (applicablePlans.length === 0) {
      this.logger.warn('未找到适用的恢复计划')
      return false
    }

    let recoverySuccess = false

    for (const plan of applicablePlans) {
      try {
        this.logger.log(`执行恢复计划: ${plan.name}`)
        await this.executePlan(plan)
        recoverySuccess = true
        this.logger.log(`恢复计划 ${plan.name} 执行成功`)
      } catch (recoveryError) {
        this.logger.error(`恢复计划 ${plan.name} 执行失败`, recoveryError)
      }
    }

    return recoverySuccess
  }

  /**
   * 执行恢复计划
   */
  private async executePlan(plan: RecoveryPlan): Promise<void> {
    const executedActions: RecoveryAction[] = []

    try {
      for (const action of plan.actions) {
        // 检查是否最近已执行过此操作
        const lastExecution = this.executedActions.get(action.id)
        if (lastExecution && Date.now() - lastExecution.getTime() < 60000) {
          this.logger.warn(`跳过最近执行过的操作: ${action.description}`)
          continue
        }

        this.logger.log(`执行恢复操作: ${action.description}`)
        await action.execute()
        executedActions.push(action)
        this.executedActions.set(action.id, new Date())
      }
    } catch (error) {
      this.logger.error('恢复操作执行失败，开始回滚', error)
      
      // 回滚已执行的操作
      for (const action of executedActions.reverse()) {
        if (action.rollback) {
          try {
            await action.rollback()
            this.logger.log(`回滚操作: ${action.description}`)
          } catch (rollbackError) {
            this.logger.error(`回滚操作失败: ${action.description}`, rollbackError)
          }
        }
      }
      
      throw error
    }
  }

  /**
   * 清理临时文件
   */
  private async cleanupTempFiles(): Promise<void> {
    const tempDir = this.configService.get<string>('TEMP_DIR') || 'temp'
    
    await retryAsync(async () => {
      try {
        const files = await fs.readdir(tempDir)
        const now = Date.now()
        const maxAge = 24 * 60 * 60 * 1000 // 24小时

        for (const file of files) {
          const filePath = join(tempDir, file)
          const stats = await fs.stat(filePath)
          
          if (now - stats.mtime.getTime() > maxAge) {
            await fs.unlink(filePath)
            this.logger.debug(`删除过期临时文件: ${file}`)
          }
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error
        }
      }
    }, FILE_OPERATION_RETRY_OPTIONS)
  }

  /**
   * 清理上传缓存
   */
  private async clearUploadCache(): Promise<void> {
    // 这里应该调用缓存服务清理上传相关的缓存
    this.logger.log('清理上传缓存')
  }

  /**
   * 清理过期文件
   */
  private async cleanupOldFiles(): Promise<void> {
    const uploadDir = this.configService.get<string>('UPLOAD_DIR') || 'uploads'
    const retentionDays = this.configService.get<number>('FILE_RETENTION_DAYS') || 30
    
    await retryAsync(async () => {
      const now = Date.now()
      const maxAge = retentionDays * 24 * 60 * 60 * 1000

      const categories = ['temp', 'images', 'documents']
      
      for (const category of categories) {
        const categoryDir = join(uploadDir, category)
        
        try {
          const files = await fs.readdir(categoryDir)
          
          for (const file of files) {
            const filePath = join(categoryDir, file)
            const stats = await fs.stat(filePath)
            
            if (now - stats.mtime.getTime() > maxAge) {
              await fs.unlink(filePath)
              this.logger.debug(`删除过期文件: ${file}`)
            }
          }
        } catch (error) {
          if (error.code !== 'ENOENT') {
            this.logger.warn(`清理目录失败: ${categoryDir}`, error.message)
          }
        }
      }
    }, FILE_OPERATION_RETRY_OPTIONS)
  }

  /**
   * 压缩日志文件
   */
  private async compressLogFiles(): Promise<void> {
    this.logger.log('压缩日志文件')
    // 实现日志文件压缩逻辑
  }

  /**
   * 重置缓存连接
   */
  private async resetCacheConnection(): Promise<void> {
    this.logger.log('重置缓存连接')
    // 这里应该调用缓存服务重置连接
  }

  /**
   * 修复文件权限
   */
  private async fixFilePermissions(): Promise<void> {
    const uploadDir = this.configService.get<string>('UPLOAD_DIR') || 'uploads'
    
    await retryAsync(async () => {
      try {
        // 修复上传目录权限
        await fs.chmod(uploadDir, 0o755)
        
        // 修复子目录权限
        const subdirs = await fs.readdir(uploadDir)
        for (const subdir of subdirs) {
          const subdirPath = join(uploadDir, subdir)
          const stats = await fs.stat(subdirPath)
          
          if (stats.isDirectory()) {
            await fs.chmod(subdirPath, 0o755)
          }
        }
        
        this.logger.log('文件权限修复完成')
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error
        }
      }
    }, FILE_OPERATION_RETRY_OPTIONS)
  }

  /**
   * 获取恢复统计信息
   */
  getRecoveryStats(): {
    totalPlans: number
    executedActions: number
    recentExecutions: Array<{ actionId: string; timestamp: Date }>
  } {
    const recentExecutions = Array.from(this.executedActions.entries())
      .map(([actionId, timestamp]) => ({ actionId, timestamp }))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10)

    return {
      totalPlans: this.recoveryPlans.size,
      executedActions: this.executedActions.size,
      recentExecutions,
    }
  }
}
