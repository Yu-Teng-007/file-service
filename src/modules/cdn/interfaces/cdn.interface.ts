export interface CDNConfig {
  provider: 'aws' | 'aliyun' | 'tencent' | 'local'
  region?: string
  bucket?: string
  accessKeyId?: string
  accessKeySecret?: string
  endpoint?: string
  customDomain?: string
  enableHttps?: boolean
}

export interface UploadOptions {
  key: string
  contentType?: string
  metadata?: Record<string, string>
  acl?: 'private' | 'public-read' | 'public-read-write'
  expires?: number // 预签名URL过期时间（秒）
}

export interface UploadResult {
  key: string
  url: string
  etag?: string
  size?: number
  location?: string
}

export interface PresignedUrlOptions {
  key: string
  expires?: number // 过期时间（秒）
  contentType?: string
  operation?: 'getObject' | 'putObject'
}

export interface PresignedUrlResult {
  url: string
  expires: Date
  fields?: Record<string, string>
}

export interface CDNProvider {
  /**
   * 上传文件到CDN
   */
  upload(filePath: string, options: UploadOptions): Promise<UploadResult>

  /**
   * 从CDN删除文件
   */
  delete(key: string): Promise<void>

  /**
   * 检查文件是否存在
   */
  exists(key: string): Promise<boolean>

  /**
   * 获取文件信息
   */
  getFileInfo(key: string): Promise<{
    size: number
    lastModified: Date
    etag: string
    contentType: string
  }>

  /**
   * 生成预签名URL
   */
  getPresignedUrl(options: PresignedUrlOptions): Promise<PresignedUrlResult>

  /**
   * 复制文件
   */
  copy(sourceKey: string, targetKey: string): Promise<void>

  /**
   * 列出文件
   */
  list(prefix?: string, maxKeys?: number): Promise<{
    files: Array<{
      key: string
      size: number
      lastModified: Date
      etag: string
    }>
    isTruncated: boolean
    nextMarker?: string
  }>
}
