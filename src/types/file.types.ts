/**
 * 文件服务类型和接口定义
 */

export enum FileCategory {
  IMAGE = 'images',
  SCRIPT = 'scripts',
  STYLE = 'styles',
  FONT = 'fonts',
  DOCUMENT = 'documents',
  MUSIC = 'music',
  VIDEO = 'videos',
  ARCHIVE = 'archives',
  TEMP = 'temp',
}

export enum FileAccessLevel {
  PUBLIC = 'public',
  PRIVATE = 'private',
  PROTECTED = 'protected',
}

export interface FileTypeConfig {
  category: FileCategory
  allowedExtensions: string[]
  maxSize: number // 字节
  mimeTypes: string[]
  description: string
}

export interface UploadedFileInfo {
  id: string
  originalName: string
  filename: string
  path: string
  url: string
  category: FileCategory
  accessLevel: FileAccessLevel
  size: number
  mimeType: string
  uploadedBy?: string
  uploadedAt: Date
  folderId?: string
  metadata?: Record<string, any>
  checksum?: string
}

export interface FileUploadOptions {
  category?: FileCategory
  accessLevel?: FileAccessLevel
  customPath?: string
  metadata?: Record<string, any>
  overwrite?: boolean
  folderId?: string
}

export interface FileSearchQuery {
  category?: FileCategory
  accessLevel?: FileAccessLevel
  uploadedBy?: string
  filename?: string
  originalName?: string
  search?: string
  dateFrom?: Date
  dateTo?: Date
  minSize?: number
  maxSize?: number
  mimeType?: string
  folderId?: string
  page?: number
  limit?: number
  sortBy?: 'name' | 'size' | 'date' | 'category'
  sortOrder?: 'asc' | 'desc'
  validateExistence?: boolean // 是否验证文件存在性，默认为 true
  autoCleanup?: boolean // 是否自动清理不存在的文件记录，默认为 false
}

export interface FileOperationResult {
  success: boolean
  message: string
  data?: any
  error?: string
}

export interface FileBatchOperation {
  action: 'delete' | 'move' | 'copy' | 'changeAccess'
  fileIds: string[]
  targetCategory?: FileCategory
  targetAccessLevel?: FileAccessLevel
}

export interface FileStats {
  totalFiles: number
  totalSize: number
  categoryCounts: Record<FileCategory, number>
  categorySizes: Record<FileCategory, number>
  accessLevelCounts: Record<FileAccessLevel, number>
}

export enum FileReadMode {
  FULL = 'full', // 完整读取到内存
  STREAM = 'stream', // 流式读取
  CHUNK = 'chunk', // 分块读取
  PARTIAL = 'partial', // 部分读取
}

export interface FileReadOptions {
  mode?: FileReadMode
  encoding?: BufferEncoding | 'buffer' // 文本编码或返回Buffer
  start?: number // 读取起始位置（字节）
  end?: number // 读取结束位置（字节）
  chunkSize?: number // 分块大小（字节）
  maxSize?: number // 最大读取大小限制
  useCache?: boolean // 是否使用缓存
  cacheKey?: string // 自定义缓存键
  cacheTTL?: number // 缓存过期时间（秒）
}

export interface FileContentResult {
  content: Buffer | string
  size: number
  mimeType: string
  encoding?: BufferEncoding
  fromCache?: boolean
  readTime: number // 读取耗时（毫秒）
}

export interface FileChunkResult {
  chunk: Buffer | string
  chunkIndex: number
  totalChunks: number
  isLast: boolean
  size: number
  offset: number
}

export interface FileReadStats {
  totalReads: number
  cacheHits: number
  cacheMisses: number
  averageReadTime: number
  totalBytesRead: number
}

export const FILE_TYPE_CONFIGS: Record<string, FileTypeConfig> = {
  jpg: {
    category: FileCategory.IMAGE,
    allowedExtensions: ['.jpg', '.jpeg'],
    maxSize: 10 * 1024 * 1024,
    mimeTypes: ['image/jpeg'],
    description: 'JPEG图片文件',
  },
  png: {
    category: FileCategory.IMAGE,
    allowedExtensions: ['.png'],
    maxSize: 10 * 1024 * 1024,
    mimeTypes: ['image/png'],
    description: 'PNG图片文件',
  },
  gif: {
    category: FileCategory.IMAGE,
    allowedExtensions: ['.gif'],
    maxSize: 5 * 1024 * 1024,
    mimeTypes: ['image/gif'],
    description: 'GIF动图文件',
  },
  webp: {
    category: FileCategory.IMAGE,
    allowedExtensions: ['.webp'],
    maxSize: 10 * 1024 * 1024,
    mimeTypes: ['image/webp'],
    description: 'WebP图片文件',
  },
  svg: {
    category: FileCategory.IMAGE,
    allowedExtensions: ['.svg'],
    maxSize: 2 * 1024 * 1024,
    mimeTypes: ['image/svg+xml'],
    description: 'SVG矢量图文件',
  },
  jpeg: {
    category: FileCategory.IMAGE,
    allowedExtensions: ['.jpeg'],
    maxSize: 10 * 1024 * 1024,
    mimeTypes: ['image/jpeg'],
    description: 'JPEG图片文件',
  },
  bmp: {
    category: FileCategory.IMAGE,
    allowedExtensions: ['.bmp'],
    maxSize: 20 * 1024 * 1024,
    mimeTypes: ['image/bmp', 'image/x-bmp'],
    description: 'BMP位图文件',
  },
  tiff: {
    category: FileCategory.IMAGE,
    allowedExtensions: ['.tiff', '.tif'],
    maxSize: 50 * 1024 * 1024,
    mimeTypes: ['image/tiff', 'image/tif'],
    description: 'TIFF图片文件',
  },
  tif: {
    category: FileCategory.IMAGE,
    allowedExtensions: ['.tif'],
    maxSize: 50 * 1024 * 1024,
    mimeTypes: ['image/tiff', 'image/tif'],
    description: 'TIF图片文件',
  },
  avif: {
    category: FileCategory.IMAGE,
    allowedExtensions: ['.avif'],
    maxSize: 10 * 1024 * 1024,
    mimeTypes: ['image/avif'],
    description: 'AVIF图片文件',
  },
  ico: {
    category: FileCategory.IMAGE,
    allowedExtensions: ['.ico'],
    maxSize: 1 * 1024 * 1024,
    mimeTypes: ['image/x-icon', 'image/vnd.microsoft.icon'],
    description: 'ICO图标文件',
  },
  heic: {
    category: FileCategory.IMAGE,
    allowedExtensions: ['.heic'],
    maxSize: 20 * 1024 * 1024,
    mimeTypes: ['image/heic'],
    description: 'HEIC图片文件',
  },
  heif: {
    category: FileCategory.IMAGE,
    allowedExtensions: ['.heif'],
    maxSize: 20 * 1024 * 1024,
    mimeTypes: ['image/heif'],
    description: 'HEIF图片文件',
  },

  js: {
    category: FileCategory.SCRIPT,
    allowedExtensions: ['.js'],
    maxSize: 5 * 1024 * 1024,
    mimeTypes: ['application/javascript', 'text/javascript'],
    description: 'JavaScript脚本文件',
  },
  ts: {
    category: FileCategory.SCRIPT,
    allowedExtensions: ['.ts'],
    maxSize: 5 * 1024 * 1024,
    mimeTypes: ['application/typescript'],
    description: 'TypeScript脚本文件',
  },
  json: {
    category: FileCategory.SCRIPT,
    allowedExtensions: ['.json'],
    maxSize: 2 * 1024 * 1024,
    mimeTypes: ['application/json'],
    description: 'JSON数据文件',
  },

  css: {
    category: FileCategory.STYLE,
    allowedExtensions: ['.css'],
    maxSize: 2 * 1024 * 1024,
    mimeTypes: ['text/css'],
    description: 'CSS样式表文件',
  },
  scss: {
    category: FileCategory.STYLE,
    allowedExtensions: ['.scss'],
    maxSize: 2 * 1024 * 1024,
    mimeTypes: ['text/scss'],
    description: 'SCSS样式表文件',
  },
  less: {
    category: FileCategory.STYLE,
    allowedExtensions: ['.less'],
    maxSize: 2 * 1024 * 1024,
    mimeTypes: ['text/less'],
    description: 'Less样式表文件',
  },

  ttf: {
    category: FileCategory.FONT,
    allowedExtensions: ['.ttf'],
    maxSize: 5 * 1024 * 1024,
    mimeTypes: ['font/ttf'],
    description: 'TrueType字体文件',
  },
  woff: {
    category: FileCategory.FONT,
    allowedExtensions: ['.woff'],
    maxSize: 5 * 1024 * 1024,
    mimeTypes: ['font/woff'],
    description: 'WOFF字体文件',
  },
  woff2: {
    category: FileCategory.FONT,
    allowedExtensions: ['.woff2'],
    maxSize: 5 * 1024 * 1024,
    mimeTypes: ['font/woff2'],
    description: 'WOFF2字体文件',
  },
  eot: {
    category: FileCategory.FONT,
    allowedExtensions: ['.eot'],
    maxSize: 5 * 1024 * 1024,
    mimeTypes: ['application/vnd.ms-fontobject'],
    description: 'EOT字体文件',
  },

  pdf: {
    category: FileCategory.DOCUMENT,
    allowedExtensions: ['.pdf'],
    maxSize: 20 * 1024 * 1024,
    mimeTypes: ['application/pdf'],
    description: 'PDF文档文件',
  },
  txt: {
    category: FileCategory.DOCUMENT,
    allowedExtensions: ['.txt'],
    maxSize: 5 * 1024 * 1024,
    mimeTypes: ['text/plain'],
    description: '纯文本文件',
  },
  doc: {
    category: FileCategory.DOCUMENT,
    allowedExtensions: ['.doc'],
    maxSize: 20 * 1024 * 1024,
    mimeTypes: ['application/msword'],
    description: 'Word文档文件',
  },
  docx: {
    category: FileCategory.DOCUMENT,
    allowedExtensions: ['.docx'],
    maxSize: 20 * 1024 * 1024,
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    description: 'Word文档文件(新版)',
  },
  xls: {
    category: FileCategory.DOCUMENT,
    allowedExtensions: ['.xls'],
    maxSize: 20 * 1024 * 1024,
    mimeTypes: ['application/vnd.ms-excel'],
    description: 'Excel电子表格文件',
  },
  xlsx: {
    category: FileCategory.DOCUMENT,
    allowedExtensions: ['.xlsx'],
    maxSize: 20 * 1024 * 1024,
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    description: 'Excel电子表格文件(新版)',
  },
  ppt: {
    category: FileCategory.DOCUMENT,
    allowedExtensions: ['.ppt'],
    maxSize: 50 * 1024 * 1024,
    mimeTypes: ['application/vnd.ms-powerpoint'],
    description: 'PowerPoint演示文稿文件',
  },
  pptx: {
    category: FileCategory.DOCUMENT,
    allowedExtensions: ['.pptx'],
    maxSize: 50 * 1024 * 1024,
    mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    description: 'PowerPoint演示文稿文件(新版)',
  },
  rtf: {
    category: FileCategory.DOCUMENT,
    allowedExtensions: ['.rtf'],
    maxSize: 10 * 1024 * 1024,
    mimeTypes: ['application/rtf', 'text/rtf'],
    description: '富文本格式文件',
  },
  odt: {
    category: FileCategory.DOCUMENT,
    allowedExtensions: ['.odt'],
    maxSize: 20 * 1024 * 1024,
    mimeTypes: ['application/vnd.oasis.opendocument.text'],
    description: 'OpenDocument文本文档',
  },
  ods: {
    category: FileCategory.DOCUMENT,
    allowedExtensions: ['.ods'],
    maxSize: 20 * 1024 * 1024,
    mimeTypes: ['application/vnd.oasis.opendocument.spreadsheet'],
    description: 'OpenDocument电子表格',
  },
  odp: {
    category: FileCategory.DOCUMENT,
    allowedExtensions: ['.odp'],
    maxSize: 50 * 1024 * 1024,
    mimeTypes: ['application/vnd.oasis.opendocument.presentation'],
    description: 'OpenDocument演示文稿',
  },

  mp3: {
    category: FileCategory.MUSIC,
    allowedExtensions: ['.mp3'],
    maxSize: 50 * 1024 * 1024,
    mimeTypes: ['audio/mpeg', 'audio/mp3'],
    description: 'MP3音频文件',
  },
  wav: {
    category: FileCategory.MUSIC,
    allowedExtensions: ['.wav'],
    maxSize: 100 * 1024 * 1024,
    mimeTypes: ['audio/wav'],
    description: 'WAV音频文件',
  },
  flac: {
    category: FileCategory.MUSIC,
    allowedExtensions: ['.flac'],
    maxSize: 100 * 1024 * 1024,
    mimeTypes: ['audio/flac'],
    description: 'FLAC无损音频文件',
  },
  ogg: {
    category: FileCategory.MUSIC,
    allowedExtensions: ['.ogg'],
    maxSize: 50 * 1024 * 1024,
    mimeTypes: ['audio/ogg'],
    description: 'OGG音频文件',
  },
}

export const CATEGORY_CONFIGS: Record<
  FileCategory,
  { maxFiles: number; totalSizeLimit: number; description: string }
> = {
  [FileCategory.IMAGE]: {
    maxFiles: 1000,
    totalSizeLimit: 1024 * 1024 * 1024, // 1GB
    description: '图片文件存储',
  },
  [FileCategory.SCRIPT]: {
    maxFiles: 500,
    totalSizeLimit: 512 * 1024 * 1024, // 512MB
    description: '脚本文件存储',
  },
  [FileCategory.STYLE]: {
    maxFiles: 500,
    totalSizeLimit: 256 * 1024 * 1024, // 256MB
    description: '样式表文件存储',
  },
  [FileCategory.FONT]: {
    maxFiles: 100,
    totalSizeLimit: 256 * 1024 * 1024, // 256MB
    description: '字体文件存储',
  },
  [FileCategory.DOCUMENT]: {
    maxFiles: 500,
    totalSizeLimit: 2 * 1024 * 1024 * 1024, // 2GB
    description: '文档文件存储',
  },
  [FileCategory.MUSIC]: {
    maxFiles: 10000,
    totalSizeLimit: 10 * 1024 * 1024 * 1024, // 10GB
    description: '音频文件存储',
  },
  [FileCategory.VIDEO]: {
    maxFiles: 1000,
    totalSizeLimit: 20 * 1024 * 1024 * 1024, // 20GB
    description: '视频文件存储',
  },
  [FileCategory.ARCHIVE]: {
    maxFiles: 200,
    totalSizeLimit: 5 * 1024 * 1024 * 1024, // 5GB
    description: '压缩包文件存储',
  },
  [FileCategory.TEMP]: {
    maxFiles: 100,
    totalSizeLimit: 100 * 1024 * 1024, // 100MB
    description: '临时文件存储',
  },
}
