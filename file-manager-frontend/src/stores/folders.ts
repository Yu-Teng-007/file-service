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

    return roots
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
