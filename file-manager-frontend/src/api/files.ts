import apiClient from './client'
import type {
  FileInfo,
  FileUploadOptions,
  FileListQuery,
  FileListResponse,
  ApiResponse,
  BatchOperation,
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
}

export default FilesApi
