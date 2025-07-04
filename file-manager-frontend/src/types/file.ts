/**
 * 文件相关类型定义
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

export interface FileInfo {
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
  uploadedAt: string
  folderId?: string
  metadata?: Record<string, any>
  checksum?: string
}

export interface FileUploadOptions {
  category?: FileCategory
  accessLevel?: FileAccessLevel
  customPath?: string
  overwrite?: boolean
  metadata?: Record<string, any>
}

export interface FileListQuery {
  page?: number
  limit?: number
  category?: FileCategory
  search?: string
  folderId?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface FileListResponse {
  files: FileInfo[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data?: T
}

export interface UploadProgress {
  fileId: string
  fileName: string
  progress: number
  status: 'uploading' | 'success' | 'error'
  error?: string
}

export interface BatchOperation {
  action: 'delete' | 'move' | 'copy' | 'restore' | 'permanentDelete'
  fileIds: string[]
  targetCategory?: FileCategory
  targetAccessLevel?: FileAccessLevel
  targetPath?: string
}

// 文件夹相关类型
export interface FolderInfo {
  id: string
  name: string
  path: string
  parentId?: string
  children?: FolderInfo[]
  fileCount: number
  totalSize: number
  createdAt: string
  updatedAt: string
  isSystem?: boolean // 标识是否为系统默认文件夹
}

export interface FolderCreateDto {
  name: string
  parentId?: string
  path?: string
}

// 图片处理相关类型
export interface ImageProcessingOptions {
  resize?: {
    width?: number
    height?: number
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
    position?: string
  }
  compress?: {
    quality?: number
    progressive?: boolean
  }
  watermark?: {
    text?: string
    image?: string
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
    opacity?: number
  }
  format?: 'jpeg' | 'png' | 'webp' | 'avif'
  stripMetadata?: boolean
}

export interface ImageProcessingResult {
  originalSize: number
  processedSize: number
  compressionRatio: number
  info: {
    width: number
    height: number
    format: string
    channels: number
  }
}

// 文件预览相关类型
export interface FilePreviewInfo {
  id: string
  type: 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'code' | 'office' | 'unsupported'
  previewUrl?: string
  thumbnailUrl?: string
  canEdit?: boolean
  metadata?: {
    duration?: number // 视频/音频时长
    dimensions?: { width: number; height: number } // 图片/视频尺寸
    pages?: number // PDF页数
    encoding?: string // 文本编码
    language?: string // 代码语言
  }
}

// 回收站相关类型
export interface TrashItem {
  id: string
  originalFileInfo: FileInfo
  deletedAt: string
  deletedBy?: string
  originalPath: string
}

// 文件版本相关类型
export interface FileVersion {
  id: string
  fileId: string
  version: number
  size: number
  checksum: string
  createdAt: string
  createdBy?: string
  comment?: string
}

// 文件标签相关类型
export interface FileTag {
  id: string
  name: string
  color: string
  description?: string
}

export interface FileWithTags extends FileInfo {
  tags?: FileTag[]
  folder?: FolderInfo
  versions?: FileVersion[]
  isDeleted?: boolean
}
