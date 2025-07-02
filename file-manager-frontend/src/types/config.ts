/**
 * 配置相关类型定义
 */

export interface AppConfig {
  apiBaseUrl: string
  apiKey: string
  maxFileSize: number
  allowedFileTypes: string[]
  uploadChunkSize: number
  theme: 'light' | 'dark' | 'auto'
  language: 'zh-CN' | 'en-US'
}

export interface SystemInfo {
  version: string
  uptime: number
  totalFiles: number
  totalSize: number
  diskUsage: {
    used: number
    total: number
    free: number
  }
}
