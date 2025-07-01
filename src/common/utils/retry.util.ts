import { Logger } from '@nestjs/common'

export interface RetryOptions {
  maxAttempts: number
  delay: number
  backoffMultiplier?: number
  maxDelay?: number
  retryCondition?: (error: any) => boolean
  onRetry?: (error: any, attempt: number) => void
}

export interface CircuitBreakerOptions {
  failureThreshold: number
  resetTimeout: number
  monitoringPeriod: number
}

/**
 * 重试装饰器
 */
export function Retry(options: RetryOptions) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value
    const logger = new Logger(`${target.constructor.name}.${propertyName}`)

    descriptor.value = async function (...args: any[]) {
      let lastError: any
      
      for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
        try {
          return await method.apply(this, args)
        } catch (error) {
          lastError = error
          
          // 检查是否应该重试
          if (options.retryCondition && !options.retryCondition(error)) {
            throw error
          }
          
          // 如果是最后一次尝试，直接抛出错误
          if (attempt === options.maxAttempts) {
            logger.error(`方法 ${propertyName} 在 ${attempt} 次尝试后失败`, error)
            throw error
          }
          
          // 计算延迟时间
          const delay = Math.min(
            options.delay * Math.pow(options.backoffMultiplier || 1, attempt - 1),
            options.maxDelay || Number.MAX_SAFE_INTEGER
          )
          
          logger.warn(`方法 ${propertyName} 第 ${attempt} 次尝试失败，${delay}ms 后重试`, error.message)
          
          // 调用重试回调
          if (options.onRetry) {
            options.onRetry(error, attempt)
          }
          
          // 等待指定时间后重试
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
      
      throw lastError
    }
  }
}

/**
 * 重试工具函数
 */
export async function retryAsync<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const logger = new Logger('RetryUtil')
  let lastError: any
  
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      
      if (options.retryCondition && !options.retryCondition(error)) {
        throw error
      }
      
      if (attempt === options.maxAttempts) {
        logger.error(`操作在 ${attempt} 次尝试后失败`, error)
        throw error
      }
      
      const delay = Math.min(
        options.delay * Math.pow(options.backoffMultiplier || 1, attempt - 1),
        options.maxDelay || Number.MAX_SAFE_INTEGER
      )
      
      logger.warn(`操作第 ${attempt} 次尝试失败，${delay}ms 后重试`, error.message)
      
      if (options.onRetry) {
        options.onRetry(error, attempt)
      }
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}

/**
 * 断路器状态
 */
enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * 断路器实现
 */
export class CircuitBreaker {
  private state = CircuitBreakerState.CLOSED
  private failureCount = 0
  private lastFailureTime = 0
  private successCount = 0
  private readonly logger = new Logger(CircuitBreaker.name)

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
        this.state = CircuitBreakerState.HALF_OPEN
        this.successCount = 0
        this.logger.log(`断路器 ${this.name} 进入半开状态`)
      } else {
        throw new Error(`断路器 ${this.name} 处于开启状态，拒绝执行操作`)
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failureCount = 0
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++
      if (this.successCount >= 3) { // 连续3次成功后关闭断路器
        this.state = CircuitBreakerState.CLOSED
        this.logger.log(`断路器 ${this.name} 关闭`)
      }
    }
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN
      this.logger.warn(`断路器 ${this.name} 在半开状态下失败，重新开启`)
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitBreakerState.OPEN
      this.logger.warn(`断路器 ${this.name} 开启，失败次数: ${this.failureCount}`)
    }
  }

  getState(): string {
    return this.state
  }

  getStats(): {
    state: string
    failureCount: number
    lastFailureTime: number
    successCount: number
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount,
    }
  }
}

/**
 * 断路器装饰器
 */
export function CircuitBreakerDecorator(name: string, options: CircuitBreakerOptions) {
  const circuitBreaker = new CircuitBreaker(name, options)
  
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value
    
    descriptor.value = async function (...args: any[]) {
      return circuitBreaker.execute(() => method.apply(this, args))
    }
  }
}

/**
 * 判断错误是否可重试
 */
export function isRetryableError(error: any): boolean {
  if (!error) return false
  
  // 网络相关错误
  if (error.code === 'ECONNREFUSED' || 
      error.code === 'ENOTFOUND' || 
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNRESET') {
    return true
  }
  
  // HTTP 状态码
  if (error.status || error.statusCode) {
    const status = error.status || error.statusCode
    // 5xx 服务器错误和 429 限流错误可重试
    return status >= 500 || status === 429
  }
  
  // 特定错误消息
  const message = error.message?.toLowerCase() || ''
  if (message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('network') ||
      message.includes('temporary')) {
    return true
  }
  
  return false
}

/**
 * 默认重试选项
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  delay: 1000,
  backoffMultiplier: 2,
  maxDelay: 10000,
  retryCondition: isRetryableError,
}

/**
 * 文件操作重试选项
 */
export const FILE_OPERATION_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  delay: 500,
  backoffMultiplier: 1.5,
  maxDelay: 5000,
  retryCondition: (error) => {
    return isRetryableError(error) || 
           error.code === 'EBUSY' || 
           error.code === 'EMFILE' ||
           error.code === 'ENFILE'
  },
}

/**
 * 网络操作重试选项
 */
export const NETWORK_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 5,
  delay: 1000,
  backoffMultiplier: 2,
  maxDelay: 30000,
  retryCondition: isRetryableError,
}
