import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import FilesApi from '@/api/files'
import type { FileInfo, FileListQuery, UploadProgress, BatchOperation } from '@/types/file'

export const useFilesStore = defineStore('files', () => {
  // 状态
  const files = ref<FileInfo[]>([])
  const selectedFiles = ref<string[]>([])
  const loading = ref(false)
  const uploading = ref(false)
  const uploadProgress = ref<UploadProgress[]>([])
  const currentPage = ref(1)
  const pageSize = ref(20)
  const total = ref(0)
  const searchQuery = ref('')
  const categoryFilter = ref('')
  const folderFilter = ref<string>()
  const sortBy = ref('uploadedAt')
  const sortOrder = ref<'asc' | 'desc'>('desc')

  // 计算属性
  const totalPages = computed(() => Math.ceil(total.value / pageSize.value))
  const hasSelection = computed(() => selectedFiles.value.length > 0)
  const selectedCount = computed(() => selectedFiles.value.length)
  const isAllSelected = computed(
    () => files.value.length > 0 && selectedFiles.value.length === files.value.length
  )

  // 方法
  const loadFiles = async (query: Partial<FileListQuery> = {}) => {
    loading.value = true
    try {
      const params: FileListQuery = {
        page: currentPage.value,
        limit: pageSize.value,
        search: searchQuery.value || undefined,
        category: categoryFilter.value || undefined,
        sortBy: sortBy.value,
        sortOrder: sortOrder.value,
        ...query,
      }

      const response = await FilesApi.getFileList(params)
      files.value = response.files
      total.value = response.total
      currentPage.value = response.page
    } catch (error) {
      console.error('Failed to load files:', error)
    } finally {
      loading.value = false
    }
  }

  const refreshFiles = () => {
    return loadFiles()
  }

  const uploadFile = async (
    file: File,
    options: any = {},
    onProgress?: (progress: number) => void
  ): Promise<FileInfo> => {
    const progressId = `${file.name}-${Date.now()}`

    // 添加到上传进度列表
    uploadProgress.value.push({
      fileId: progressId,
      fileName: file.name,
      progress: 0,
      status: 'uploading',
    })

    try {
      uploading.value = true

      const result = await FilesApi.uploadFile(file, options, progress => {
        const item = uploadProgress.value.find(p => p.fileId === progressId)
        if (item) {
          item.progress = progress
        }
        onProgress?.(progress)
      })

      // 更新上传状态
      const item = uploadProgress.value.find(p => p.fileId === progressId)
      if (item) {
        item.status = 'success'
        item.progress = 100
      }

      // 刷新文件列表
      await refreshFiles()

      return result
    } catch (error) {
      // 更新上传状态
      const item = uploadProgress.value.find(p => p.fileId === progressId)
      if (item) {
        item.status = 'error'
        item.error = error instanceof Error ? error.message : '上传失败'
      }
      throw error
    } finally {
      uploading.value = false

      // 3秒后移除上传进度项
      setTimeout(() => {
        const index = uploadProgress.value.findIndex(p => p.fileId === progressId)
        if (index > -1) {
          uploadProgress.value.splice(index, 1)
        }
      }, 3000)
    }
  }

  const uploadMultipleFiles = async (
    files: File[],
    options: any = {},
    onProgress?: (progress: number) => void
  ): Promise<FileInfo[]> => {
    uploading.value = true
    try {
      const result = await FilesApi.uploadMultipleFiles(files, options, onProgress)
      await refreshFiles()
      return result
    } catch (error) {
      throw error
    } finally {
      uploading.value = false
    }
  }

  const deleteFile = async (id: string) => {
    await FilesApi.deleteFile(id)
    await refreshFiles()
    // 从选中列表中移除
    const index = selectedFiles.value.indexOf(id)
    if (index > -1) {
      selectedFiles.value.splice(index, 1)
    }
  }

  const deleteSelectedFiles = async () => {
    if (selectedFiles.value.length === 0) return

    const operation: BatchOperation = {
      action: 'delete',
      fileIds: selectedFiles.value,
    }

    await FilesApi.batchOperation(operation)
    await refreshFiles()
    selectedFiles.value = []
  }

  const updateFile = async (id: string, updates: any) => {
    const result = await FilesApi.updateFile(id, updates)

    // 更新本地文件列表
    const index = files.value.findIndex(f => f.id === id)
    if (index > -1) {
      files.value[index] = result
    }

    return result
  }

  const downloadFile = async (id: string, filename?: string) => {
    await FilesApi.downloadFile(id, filename)
  }

  const selectFile = (id: string) => {
    if (!selectedFiles.value.includes(id)) {
      selectedFiles.value.push(id)
    }
  }

  const unselectFile = (id: string) => {
    const index = selectedFiles.value.indexOf(id)
    if (index > -1) {
      selectedFiles.value.splice(index, 1)
    }
  }

  const toggleFileSelection = (id: string) => {
    if (selectedFiles.value.includes(id)) {
      unselectFile(id)
    } else {
      selectFile(id)
    }
  }

  const selectAllFiles = () => {
    selectedFiles.value = files.value.map(f => f.id)
  }

  const clearSelection = () => {
    selectedFiles.value = []
  }

  const toggleSelectAll = () => {
    if (isAllSelected.value) {
      clearSelection()
    } else {
      selectAllFiles()
    }
  }

  const setPage = (page: number) => {
    currentPage.value = page
    loadFiles()
  }

  const setPageSize = (size: number) => {
    pageSize.value = size
    currentPage.value = 1
    loadFiles()
  }

  const setSearch = (query: string) => {
    searchQuery.value = query
    currentPage.value = 1
    loadFiles()
  }

  const setCategoryFilter = (category: string) => {
    categoryFilter.value = category
    currentPage.value = 1
    loadFiles()
  }

  const setFolderFilter = (folderId?: string) => {
    folderFilter.value = folderId
    currentPage.value = 1
    loadFiles()
  }

  const setSorting = (field: string, order: 'asc' | 'desc') => {
    sortBy.value = field
    sortOrder.value = order
    loadFiles()
  }

  const clearUploadProgress = () => {
    uploadProgress.value = []
  }

  return {
    // 状态
    files,
    selectedFiles,
    loading,
    uploading,
    uploadProgress,
    currentPage,
    pageSize,
    total,
    searchQuery,
    categoryFilter,
    folderFilter,
    sortBy,
    sortOrder,

    // 计算属性
    totalPages,
    hasSelection,
    selectedCount,
    isAllSelected,

    // 方法
    loadFiles,
    refreshFiles,
    uploadFile,
    uploadMultipleFiles,
    deleteFile,
    deleteSelectedFiles,
    updateFile,
    downloadFile,
    selectFile,
    unselectFile,
    toggleFileSelection,
    selectAllFiles,
    clearSelection,
    toggleSelectAll,
    setPage,
    setPageSize,
    setSearch,
    setCategoryFilter,
    setFolderFilter,
    setSorting,
    clearUploadProgress,
  }
})
