import { registerAs } from '@nestjs/config'

/**
 * 应用配置
 */
export const appConfig = registerAs('app', () => ({
  // 服务器配置
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  // 文件存储配置
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 104857600,
  tempDir: process.env.TEMP_DIR || 'temp',

  // 安全配置
  jwtSecret: process.env.JWT_SECRET || 'default-jwt-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  apiKey: process.env.API_KEY || 'default-api-key',

  // CORS 配置
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5800'],

  // 速率限制
  rateLimitTtl: parseInt(process.env.RATE_LIMIT_TTL, 10) || 60,
  rateLimitLimit: parseInt(process.env.RATE_LIMIT_LIMIT, 10) || 100,
}))

/**
 * Redis 配置
 */
export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || '',
  db: parseInt(process.env.REDIS_DB, 10) || 0,
  ttl: parseInt(process.env.CACHE_TTL, 10) || 3600,
  maxItems: parseInt(process.env.CACHE_MAX_ITEMS, 10) || 1000,
}))

/**
 * CDN 配置
 */
export const cdnConfig = registerAs('cdn', () => ({
  provider: process.env.CDN_PROVIDER || 'local',
  region: process.env.CDN_REGION || '',
  bucket: process.env.CDN_BUCKET || '',
  accessKeyId: process.env.CDN_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.CDN_ACCESS_KEY_SECRET || '',
  endpoint: process.env.CDN_ENDPOINT || '',
  customDomain: process.env.CDN_CUSTOM_DOMAIN || '',
  enableHttps: process.env.CDN_ENABLE_HTTPS === 'true',
}))

/**
 * 监控配置
 */
export const monitoringConfig = registerAs('monitoring', () => ({
  accessLogging: process.env.MONITORING_ACCESS_LOGGING === 'true',
  performance: process.env.MONITORING_PERFORMANCE === 'true',
  storage: process.env.MONITORING_STORAGE === 'true',
  logRetentionDays: parseInt(process.env.MONITORING_LOG_RETENTION_DAYS, 10) || 30,
  metricsRetentionDays: parseInt(process.env.MONITORING_METRICS_RETENTION_DAYS, 10) || 90,
}))

/**
 * 图片处理配置
 */
export const imageConfig = registerAs('image', () => ({
  processingEnabled: process.env.IMAGE_PROCESSING_ENABLED === 'true',
  maxSize: process.env.IMAGE_MAX_SIZE || '50MB',
  qualityDefault: parseInt(process.env.IMAGE_QUALITY_DEFAULT, 10) || 80,
}))

/**
 * 文件类型限制配置
 */
export const fileLimitsConfig = registerAs('fileLimits', () => ({
  maxImageSize: parseInt(process.env.MAX_IMAGE_SIZE, 10) || 10485760,
  maxScriptSize: parseInt(process.env.MAX_SCRIPT_SIZE, 10) || 5242880,
  maxStyleSize: parseInt(process.env.MAX_STYLE_SIZE, 10) || 2097152,
  maxFontSize: parseInt(process.env.MAX_FONT_SIZE, 10) || 5242880,
  maxDocumentSize: parseInt(process.env.MAX_DOCUMENT_SIZE, 10) || 20971520,
  maxMusicSize: parseInt(process.env.MAX_MUSIC_SIZE, 10) || 52428800,
}))

/**
 * 存储配置
 */
export const storageConfig = registerAs('storage', () => ({
  provider: process.env.STORAGE_PROVIDER || 'local',
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || '',
    bucket: process.env.AWS_S3_BUCKET || '',
  },
  aliyun: {
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
    region: process.env.ALIYUN_OSS_REGION || '',
    bucket: process.env.ALIYUN_OSS_BUCKET || '',
  },
}))

/**
 * 数据库配置
 */
export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL || 'sqlite:./data/fileservice.db',
}))

/**
 * 安全功能配置
 */
export const securityConfig = registerAs('security', () => ({
  enableVirusScan: process.env.ENABLE_VIRUS_SCAN === 'true',
  virusScanApiKey: process.env.VIRUS_SCAN_API_KEY || '',
  forceHttps: process.env.FORCE_HTTPS === 'true',
  sslCertPath: process.env.SSL_CERT_PATH || '',
  sslKeyPath: process.env.SSL_KEY_PATH || '',
}))

/**
 * 开发环境特定配置
 */
export const devConfig = registerAs('dev', () => ({
  debug: process.env.DEBUG === 'true',
  enableSwagger: process.env.ENABLE_SWAGGER === 'true',
  enableCorsCredentials: process.env.ENABLE_CORS_CREDENTIALS === 'true',
  enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING === 'true',
  enableErrorStackTrace: process.env.ENABLE_ERROR_STACK_TRACE === 'true',
}))

/**
 * 性能配置
 */
export const performanceConfig = registerAs('performance', () => ({
  enableClustering: process.env.ENABLE_CLUSTERING === 'true',
  clusterWorkers: parseInt(process.env.CLUSTER_WORKERS, 10) || 0,
  enableGzip: process.env.ENABLE_GZIP === 'true',
  enableEtag: process.env.ENABLE_ETAG === 'true',
  healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT, 10) || 5000,
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL, 10) || 30000,
}))

/**
 * 配置验证
 */
export const validateConfig = () => {
  const nodeEnv = process.env.NODE_ENV || 'development'

  // 生产环境必须设置的配置
  if (nodeEnv === 'production') {
    const requiredProdVars = ['JWT_SECRET', 'API_KEY', 'CORS_ORIGINS']

    const missingVars = requiredProdVars.filter(
      varName =>
        !process.env[varName] ||
        process.env[varName] === 'CHANGE_THIS_IN_PRODUCTION' ||
        process.env[varName] === 'CHANGE_THIS_IN_PRODUCTION_ENVIRONMENT'
    )

    if (missingVars.length > 0) {
      throw new Error(`生产环境缺少必要的环境变量: ${missingVars.join(', ')}`)
    }
  }

  // 验证端口号
  const port = parseInt(process.env.PORT, 10)
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`无效的端口号: ${process.env.PORT}`)
  }

  // 验证文件大小限制
  const maxFileSize = parseInt(process.env.MAX_FILE_SIZE, 10)
  if (isNaN(maxFileSize) || maxFileSize < 0) {
    throw new Error(`无效的最大文件大小: ${process.env.MAX_FILE_SIZE}`)
  }

  console.log(`✅ 配置验证通过 - 环境: ${nodeEnv}`)
}

/**
 * 获取所有配置
 */
export default () => ({
  app: appConfig(),
  redis: redisConfig(),
  cdn: cdnConfig(),
  monitoring: monitoringConfig(),
  image: imageConfig(),
  fileLimits: fileLimitsConfig(),
  storage: storageConfig(),
  database: databaseConfig(),
  security: securityConfig(),
  dev: devConfig(),
  performance: performanceConfig(),
})
