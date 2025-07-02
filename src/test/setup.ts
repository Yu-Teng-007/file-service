/**
 * Jest测试环境设置文件
 * 用于配置全局测试环境和抑制不必要的控制台输出
 */

// 保存原始的console方法
const originalConsole = {
  warn: console.warn,
  error: console.error,
  log: console.log,
  info: console.info,
}

// 在测试期间抑制特定的console输出
beforeEach(() => {
  // 抑制预期的警告信息
  console.warn = jest.fn((message: string, ...args: any[]) => {
    // 只抑制文件删除相关的警告
    if (
      typeof message === 'string' && 
      (message.includes('删除物理文件失败') || 
       message.includes('设置缓存失败') ||
       message.includes('获取缓存失败') ||
       message.includes('删除缓存失败'))
    ) {
      return // 抑制这些预期的警告
    }
    // 其他警告仍然显示
    originalConsole.warn(message, ...args)
  })

  // 抑制预期的错误信息（仅在测试中）
  console.error = jest.fn((message: string, ...args: any[]) => {
    // 只抑制特定的测试错误信息
    if (
      typeof message === 'string' && 
      (message.includes('图片处理失败') ||
       message.includes('Unhandled Exception') ||
       message.includes('[GlobalExceptionFilter]'))
    ) {
      return // 抑制这些预期的错误
    }
    // 其他错误仍然显示
    originalConsole.error(message, ...args)
  })
})

// 测试完成后恢复原始的console方法
afterEach(() => {
  console.warn = originalConsole.warn
  console.error = originalConsole.error
  console.log = originalConsole.log
  console.info = originalConsole.info
})

// 设置Jest环境
beforeAll(() => {
  // 设置测试环境变量
  process.env.NODE_ENV = 'test'
  
  // 抑制NestJS的启动日志
  process.env.NO_COLOR = 'true'
})

afterAll(() => {
  // 清理测试环境
  jest.clearAllMocks()
  jest.restoreAllMocks()
})
