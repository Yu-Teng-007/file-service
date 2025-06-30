export interface FileAccessLog {
  id: string
  fileId: string
  fileName: string
  filePath: string
  accessType: 'read' | 'write' | 'delete' | 'download' | 'upload'
  userAgent?: string
  ipAddress?: string
  userId?: string
  timestamp: Date
  responseTime?: number
  statusCode?: number
  errorMessage?: string
}

export interface StorageStats {
  totalFiles: number
  totalSize: number
  usedSpace: number
  availableSpace: number
  usagePercentage: number
  categoryBreakdown: Record<string, {
    count: number
    size: number
    percentage: number
  }>
}

export interface PerformanceMetrics {
  averageResponseTime: number
  requestsPerSecond: number
  errorRate: number
  throughput: number // bytes per second
  activeConnections: number
  memoryUsage: {
    used: number
    total: number
    percentage: number
  }
  cpuUsage: number
}

export interface FilePopularityStats {
  fileId: string
  fileName: string
  accessCount: number
  downloadCount: number
  lastAccessed: Date
  totalSize: number
  category: string
}

export interface AccessPattern {
  hour: number
  day: number
  month: number
  year: number
  accessCount: number
  downloadCount: number
  uploadCount: number
}

export interface ErrorStats {
  errorType: string
  count: number
  percentage: number
  lastOccurred: Date
  examples: Array<{
    message: string
    timestamp: Date
    context?: any
  }>
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical'
  uptime: number
  lastCheck: Date
  services: Array<{
    name: string
    status: 'up' | 'down' | 'degraded'
    responseTime?: number
    lastCheck: Date
    errorMessage?: string
  }>
  alerts: Array<{
    level: 'info' | 'warning' | 'error' | 'critical'
    message: string
    timestamp: Date
    resolved: boolean
  }>
}

export interface MonitoringReport {
  period: {
    start: Date
    end: Date
  }
  storageStats: StorageStats
  performanceMetrics: PerformanceMetrics
  popularFiles: FilePopularityStats[]
  accessPatterns: AccessPattern[]
  errorStats: ErrorStats[]
  systemHealth: SystemHealth
}

export interface AlertRule {
  id: string
  name: string
  description: string
  metric: string
  operator: '>' | '<' | '>=' | '<=' | '==' | '!='
  threshold: number
  enabled: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
  actions: Array<{
    type: 'email' | 'webhook' | 'log'
    config: any
  }>
}

export interface Alert {
  id: string
  ruleId: string
  ruleName: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: Date
  resolved: boolean
  resolvedAt?: Date
  metadata?: any
}

export interface MonitoringConfig {
  enableAccessLogging: boolean
  enablePerformanceMonitoring: boolean
  enableStorageMonitoring: boolean
  logRetentionDays: number
  metricsRetentionDays: number
  alertCheckInterval: number
  performanceCheckInterval: number
  storageCheckInterval: number
}
