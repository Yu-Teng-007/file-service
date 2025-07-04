import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FolderInfo } from '@/types/file'
import FilesApi from '@/api/files'

export const useFoldersStore = defineStore('folders', () => {
  // 状态
  const folders = ref<FolderInfo[]>([])
  const loading = ref(false)
  const lastLoadTime = ref<number>(0)
  const loadPromise = ref<Promise<FolderInfo[]> | null>(null)

  // 缓存时间（5分钟）
  const CACHE_DURATION = 5 * 60 * 1000

  // 计算属性
  const folderTree = computed(() => buildTree(folders.value))

  // 是否需要重新加载
  const needsReload = computed(() => {
    return Date.now() - lastLoadTime.value > CACHE_DURATION
  })

  // 方法
  const loadFolders = async (force = false) => {
    // 如果已经有正在进行的加载请求，直接返回该 Promise
    if (loadPromise.value && !force) {
      return loadPromise.value
    }

    // 如果不需要强制刷新且缓存仍然有效，直接返回缓存数据
    if (!force && !needsReload.value && folders.value.length > 0) {
      return folders.value
    }

    loading.value = true

    // 创建加载 Promise
    loadPromise.value = (async () => {
      try {
        const result = await FilesApi.getFolders()
        folders.value = result
        lastLoadTime.value = Date.now()
        return result
      } catch (error) {
        console.error('Failed to load folders:', error)
        throw error
      } finally {
        loading.value = false
        loadPromise.value = null
      }
    })()

    return loadPromise.value
  }

  const buildTree = (folders: FolderInfo[]): FolderInfo[] => {
    const map = new Map<string, FolderInfo>()
    const roots: FolderInfo[] = []

    // 添加【全部】默认文件夹
    const allFolder: FolderInfo = {
      id: 'all',
      name: '全部',
      path: '/',
      fileCount: 0, // 这里可以计算所有文件的总数
      totalSize: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSystem: true,
      children: [],
    }

    // 计算所有文件夹的文件总数
    allFolder.fileCount = folders.reduce((total, folder) => total + folder.fileCount, 0)
    allFolder.totalSize = folders.reduce((total, folder) => total + folder.totalSize, 0)

    folders.forEach(folder => {
      map.set(folder.id, { ...folder, children: [] })
    })

    folders.forEach(folder => {
      const node = map.get(folder.id)!
      if (folder.parentId && map.has(folder.parentId)) {
        const parent = map.get(folder.parentId)!
        if (!parent.children) parent.children = []
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    })

    // 将【全部】文件夹放在最前面
    return [allFolder, ...roots]
  }

  const addFolder = (folder: FolderInfo) => {
    folders.value.push(folder)
  }

  const updateFolder = (updatedFolder: FolderInfo) => {
    const index = folders.value.findIndex(f => f.id === updatedFolder.id)
    if (index !== -1) {
      folders.value[index] = updatedFolder
    }
  }

  const removeFolder = (folderId: string) => {
    folders.value = folders.value.filter(f => f.id !== folderId)
  }

  const refreshFolders = () => {
    return loadFolders(true)
  }

  return {
    // 状态
    folders,
    loading,
    folderTree,
    needsReload,

    // 方法
    loadFolders,
    addFolder,
    updateFolder,
    removeFolder,
    refreshFolders,
  }
})
