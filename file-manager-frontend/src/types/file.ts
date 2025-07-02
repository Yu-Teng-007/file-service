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
  action: 'delete' | 'move' | 'copy'
  fileIds: string[]
  targetCategory?: FileCategory
  targetAccessLevel?: FileAccessLevel
}
