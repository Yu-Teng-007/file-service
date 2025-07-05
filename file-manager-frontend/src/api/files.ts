import apiClient from './client'
import type {
  FileInfo,
  FileUploadOptions,
  FileListQuery,
  FileListResponse,
  ApiResponse,
  BatchOperation,
  FolderInfo,
  FolderCreateDto,
  ImageProcessingOptions,
  ImageProcessingResult,
  FilePreviewInfo,
  TrashItem,
  FileVersion,
  FileTag,
  FileWithTags,
} from '@/types/file'
import type { SystemInfo } from '@/types/config'

/**
 * 文件相关 API
 */
export class FilesApi {
  /**
   * 获取文件列表
   */
  static async getFileList(query: FileListQuery = {}): Promise<FileListResponse> {
    const params = new URLSearchParams()

    if (query.page) params.append('page', query.page.toString())
    if (query.limit) params.append('limit', query.limit.toString())
    if (query.category) params.append('category', query.category)
    if (query.search) params.append('search', query.search)
    // 'all' 文件夹不传递 folderId 参数，表示获取所有文件
    if (query.folderId && query.folderId !== 'all') params.append('folderId', query.folderId)
    if (query.sortBy) params.append('sortBy', query.sortBy)
    if (query.sortOrder) params.append('sortOrder', query.sortOrder)

    const response = await apiClient.get<ApiResponse<FileListResponse>>(
      `/files?${params.toString()}`
    )
    return response.data!
  }

  /**
   * 获取文件详情
   */
  static async getFileInfo(id: string): Promise<FileInfo> {
    const response = await apiClient.get<ApiResponse<FileInfo>>(`/files/${id}`)
    return response.data!
  }

  /**
   * 上传单个文件
   */
  static async uploadFile(
    file: File,
    options: FileUploadOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<FileInfo> {
    const formData = new FormData()
    formData.append('file', file)

    if (options.category) formData.append('category', options.category)
    if (options.accessLevel) formData.append('accessLevel', options.accessLevel)
    if (options.customPath) formData.append('customPath', options.customPath)
    if (options.folderId) formData.append('folderId', options.folderId)
    if (options.overwrite !== undefined) formData.append('overwrite', options.overwrite.toString())
    if (options.metadata) formData.append('metadata', JSON.stringify(options.metadata))

    const response = await apiClient.upload<ApiResponse<FileInfo>>(
      '/files/upload',
      formData,
      onProgress
    )
    return response.data!
  }

  /**
   * 上传多个文件
   */
  static async uploadMultipleFiles(
    files: File[],
    options: FileUploadOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<FileInfo[]> {
    const formData = new FormData()

    files.forEach(file => {
      formData.append('files', file)
    })

    if (options.category) formData.append('category', options.category)
    if (options.accessLevel) formData.append('accessLevel', options.accessLevel)
    if (options.customPath) formData.append('customPath', options.customPath)
    if (options.folderId) formData.append('folderId', options.folderId)
    if (options.overwrite !== undefined) formData.append('overwrite', options.overwrite.toString())
    if (options.metadata) formData.append('metadata', JSON.stringify(options.metadata))

    const response = await apiClient.upload<ApiResponse<FileInfo[]>>(
      '/files/upload/multiple',
      formData,
      onProgress
    )
    return response.data!
  }

  /**
   * 更新文件信息
   */
  static async updateFile(
    id: string,
    updates: Partial<Pick<FileInfo, 'filename' | 'accessLevel' | 'metadata'>>
  ): Promise<FileInfo> {
    const response = await apiClient.put<ApiResponse<FileInfo>>(`/files/${id}`, updates)
    return response.data!
  }

  /**
   * 删除文件
   */
  static async deleteFile(id: string): Promise<void> {
    await apiClient.delete<ApiResponse>(`/files/${id}`)
  }

  /**
   * 批量操作
   */
  static async batchOperation(operation: BatchOperation): Promise<void> {
    await apiClient.post<ApiResponse>('/files/batch', operation)
  }

  /**
   * 下载文件
   */
  static async downloadFile(id: string, filename?: string): Promise<void> {
    await apiClient.download(`/files/${id}/download`, filename)
  }

  /**
   * 获取文件预览URL
   */
  static getPreviewUrl(id: string): string {
    const baseURL = import.meta.env.VITE_API_BASE_URL
    return `${baseURL}/files/${id}/preview`
  }

  /**
   * 获取文件缩略图URL
   */
  static getThumbnailUrl(id: string, size: 'small' | 'medium' | 'large' = 'medium'): string {
    const baseURL = import.meta.env.VITE_API_BASE_URL
    return `${baseURL}/files/${id}/thumbnail?size=${size}`
  }

  /**
   * 获取文件直接访问URL（用于静态文件访问）
   */
  static getFileDirectUrl(fileUrl: string): string {
    // 如果已经是完整URL，直接返回
    if (fileUrl.startsWith('http')) {
      return fileUrl
    }
    // 静态文件服务不需要 /api 前缀
    const baseURL = import.meta.env.VITE_API_BASE_URL
    const serverUrl = baseURL.replace('/api', '')
    return `${serverUrl}${fileUrl}`
  }

  /**
   * 获取系统统计信息
   */
  static async getSystemStats(): Promise<SystemInfo> {
    try {
      // 获取监控仪表板数据
      const dashboardResponse = await apiClient.get<ApiResponse<any>>('/monitoring/dashboard')
      const dashboardData = dashboardResponse.data

      // 获取系统信息
      const systemResponse = await apiClient.get<ApiResponse<any>>('/info')
      const systemInfo = systemResponse.data

      // 转换后端数据格式为前端需要的格式
      return {
        version: systemInfo?.version || '1.0.0',
        uptime: Math.floor((dashboardData?.systemHealth?.uptime || 0) / 1000), // 转换毫秒为秒
        totalFiles: dashboardData?.storageStats?.totalFiles || 0,
        totalSize: dashboardData?.storageStats?.totalSize || 0,
        diskUsage: {
          used: dashboardData?.storageStats?.usedSpace || 0,
          total:
            (dashboardData?.storageStats?.usedSpace || 0) +
            (dashboardData?.storageStats?.availableSpace || 0),
          free: dashboardData?.storageStats?.availableSpace || 0,
        },
      }
    } catch (error) {
      console.error('Failed to fetch system stats:', error)
      // 返回默认值以防API调用失败
      return {
        version: '1.0.0',
        uptime: 0,
        totalFiles: 0,
        totalSize: 0,
        diskUsage: {
          used: 0,
          total: 0,
          free: 0,
        },
      }
    }
  }

  // ==================== 文件夹管理 API ====================

  /**
   * 获取文件夹列表
   */
  static async getFolders(parentId?: string, includeFiles: boolean = true): Promise<FolderInfo[]> {
    const params = new URLSearchParams()
    if (parentId) params.append('parentId', parentId)
    // 默认包含文件统计信息
    params.append('includeFiles', includeFiles.toString())

    const response = await apiClient.get<ApiResponse<FolderInfo[]>>(`/folders?${params.toString()}`)
    return response.data || []
  }

  /**
   * 创建文件夹
   */
  static async createFolder(folderData: FolderCreateDto): Promise<FolderInfo> {
    const response = await apiClient.post<ApiResponse<FolderInfo>>('/folders', folderData)
    return response.data!
  }

  /**
   * 删除文件夹
   */
  static async deleteFolder(id: string): Promise<void> {
    await apiClient.delete<ApiResponse>(`/folders/${id}`)
  }

  /**
   * 重命名文件夹
   */
  static async renameFolder(id: string, name: string): Promise<FolderInfo> {
    const response = await apiClient.put<ApiResponse<FolderInfo>>(`/folders/${id}`, { name })
    return response.data!
  }

  /**
   * 移动文件到文件夹
   */
  static async moveFilesToFolder(fileIds: string[], folderId: string): Promise<void> {
    await apiClient.post<ApiResponse>(`/folders/${folderId}/move`, {
      fileIds,
    })
  }

  // ==================== 图片处理 API ====================

  /**
   * 处理图片
   */
  static async processImage(
    file: File,
    options: ImageProcessingOptions
  ): Promise<ImageProcessingResult> {
    const formData = new FormData()
    formData.append('image', file)
    formData.append('options', JSON.stringify(options))

    const response = await apiClient.post<ApiResponse<ImageProcessingResult>>(
      '/image-processing/process',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    console.log('Raw API response:', response)
    // 检查响应结构，如果有嵌套的data字段则提取，否则直接使用
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      return response.data.data!
    } else {
      return response.data as ImageProcessingResult
    }
  }

  /**
   * 生成缩略图
   */
  static async generateThumbnail(
    fileId: string,
    size: 'small' | 'medium' | 'large' = 'medium'
  ): Promise<string> {
    const response = await apiClient.post<ApiResponse<{ url: string }>>(
      '/image-processing/thumbnails',
      {
        fileId,
        size,
      }
    )
    return response.data!.url
  }

  /**
   * 压缩图片
   */
  static async compressImage(fileId: string, quality: number = 80): Promise<string> {
    const response = await apiClient.post<ApiResponse<{ url: string }>>(
      '/image-processing/compress',
      {
        fileId,
        quality,
      }
    )
    return response.data!.url
  }

  /**
   * 调整图片尺寸
   */
  static async resizeImage(
    file: File,
    width: number,
    height?: number
  ): Promise<ImageProcessingResult> {
    const formData = new FormData()
    formData.append('image', file)
    formData.append('width', width.toString())
    if (height) formData.append('height', height.toString())

    const response = await apiClient.post<ApiResponse<ImageProcessingResult>>(
      '/image-processing/resize',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data!
  }

  /**
   * 保存处理后的图片
   */
  static async saveProcessedImage(
    processedUrl: string,
    filename: string,
    folderId?: string,
    overwrite?: boolean,
    originalFileId?: string
  ): Promise<{ fileId: string; url: string }> {
    const response = await apiClient.post<ApiResponse<{ fileId: string; url: string }>>(
      '/image-processing/save-processed',
      {
        processedUrl,
        filename,
        folderId,
        overwrite,
        originalFileId,
      }
    )
    return response.data!
  }

  // ==================== 文件预览 API ====================

  /**
   * 获取文件预览信息
   */
  static async getFilePreviewInfo(id: string): Promise<FilePreviewInfo> {
    const response = await apiClient.get<ApiResponse<FilePreviewInfo>>(`/files/${id}/preview-info`)
    return response.data!
  }

  /**
   * 获取文件内容（用于文本文件预览）
   */
  static async getFileContent(
    id: string,
    options?: {
      mode?: 'full' | 'partial'
      encoding?: string
      start?: number
      end?: number
      maxSize?: number
    }
  ): Promise<{ content: string; fromCache: boolean; metadata: any }> {
    const params = new URLSearchParams()
    if (options?.mode) params.append('mode', options.mode)
    if (options?.encoding) params.append('encoding', options.encoding)
    if (options?.start !== undefined) params.append('start', options.start.toString())
    if (options?.end !== undefined) params.append('end', options.end.toString())
    if (options?.maxSize) params.append('maxSize', options.maxSize.toString())

    const response = await apiClient.get<ApiResponse<any>>(
      `/files/${id}/content?${params.toString()}`
    )
    return response.data!
  }

  // ==================== 回收站 API ====================

  /**
   * 获取回收站文件列表
   */
  static async getTrashFiles(): Promise<TrashItem[]> {
    const response = await apiClient.get<ApiResponse<TrashItem[]>>('/files/trash')
    return response.data || []
  }

  /**
   * 从回收站恢复文件
   */
  static async restoreFromTrash(fileIds: string[]): Promise<void> {
    await apiClient.post<ApiResponse>('/files/trash/restore', { fileIds })
  }

  /**
   * 永久删除文件
   */
  static async permanentDeleteFiles(fileIds: string[]): Promise<void> {
    await apiClient.delete<ApiResponse>('/files/trash/permanent', {
      data: { fileIds },
    })
  }

  /**
   * 清空回收站
   */
  static async emptyTrash(): Promise<void> {
    await apiClient.delete<ApiResponse>('/files/trash/empty')
  }

  // ==================== 标签管理 API ====================

  /**
   * 获取所有标签
   */
  static async getTags(): Promise<FileTag[]> {
    const response = await apiClient.get<ApiResponse<FileTag[]>>('/tags')
    return response.data || []
  }

  /**
   * 创建标签
   */
  static async createTag(tag: Omit<FileTag, 'id'>): Promise<FileTag> {
    const response = await apiClient.post<ApiResponse<FileTag>>('/tags', tag)
    return response.data!
  }

  /**
   * 为文件添加标签
   */
  static async addTagsToFile(fileId: string, tagIds: string[]): Promise<void> {
    await apiClient.post<ApiResponse>(`/files/${fileId}/tags`, { tagIds })
  }

  /**
   * 从文件移除标签
   */
  static async removeTagsFromFile(fileId: string, tagIds: string[]): Promise<void> {
    await apiClient.delete<ApiResponse>(`/files/${fileId}/tags`, {
      data: { tagIds },
    })
  }

  // ==================== 文件版本 API ====================

  /**
   * 获取文件版本历史
   */
  static async getFileVersions(fileId: string): Promise<FileVersion[]> {
    const response = await apiClient.get<ApiResponse<FileVersion[]>>(`/files/${fileId}/versions`)
    return response.data || []
  }

  /**
   * 创建文件版本
   */
  static async createFileVersion(
    fileId: string,
    file: File,
    comment?: string
  ): Promise<FileVersion> {
    const formData = new FormData()
    formData.append('file', file)
    if (comment) formData.append('comment', comment)

    const response = await apiClient.post<ApiResponse<FileVersion>>(
      `/files/${fileId}/versions`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data!
  }

  /**
   * 恢复到指定版本
   */
  static async restoreFileVersion(fileId: string, versionId: string): Promise<void> {
    await apiClient.post<ApiResponse>(`/files/${fileId}/versions/${versionId}/restore`)
  }
}

export default FilesApi
