import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AppConfig } from '@/types/config'

export const useConfigStore = defineStore('config', () => {
  // 状态
  const config = ref<AppConfig>({
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
    apiKey: import.meta.env.VITE_API_KEY || '',
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedFileTypes: [
      'image/*',
      'text/*',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
      'audio/*',
      'video/*',
    ],
    uploadChunkSize: 1024 * 1024, // 1MB
    theme: 'auto',
    language: 'zh-CN',
  })

  // 计算属性
  const apiBaseUrl = computed(() => config.value.apiBaseUrl)
  const apiKey = computed(() => config.value.apiKey)
  const maxFileSize = computed(() => config.value.maxFileSize)
  const allowedFileTypes = computed(() => config.value.allowedFileTypes)
  const uploadChunkSize = computed(() => config.value.uploadChunkSize)
  const theme = computed(() => config.value.theme)
  const language = computed(() => config.value.language)

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const maxFileSizeFormatted = computed(() => formatFileSize(config.value.maxFileSize))

  // 方法
  const updateConfig = (newConfig: Partial<AppConfig>) => {
    config.value = { ...config.value, ...newConfig }
    saveToLocalStorage()
  }

  const updateApiConfig = (apiBaseUrl: string, apiKey: string) => {
    config.value.apiBaseUrl = apiBaseUrl
    config.value.apiKey = apiKey
    saveToLocalStorage()

    // 更新 API 客户端配置
    import('@/api/client').then(({ apiClient }) => {
      apiClient.updateConfig(apiBaseUrl, apiKey)
    })
  }

  const updateTheme = (newTheme: AppConfig['theme']) => {
    config.value.theme = newTheme
    saveToLocalStorage()
    applyTheme()
  }

  const updateLanguage = (newLanguage: AppConfig['language']) => {
    config.value.language = newLanguage
    saveToLocalStorage()
  }

  const applyTheme = () => {
    const { theme } = config.value
    const isDark =
      theme === 'dark' ||
      (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    document.documentElement.classList.toggle('dark', isDark)
  }

  const saveToLocalStorage = () => {
    localStorage.setItem('file-manager-config', JSON.stringify(config.value))
  }

  const loadFromLocalStorage = () => {
    const saved = localStorage.getItem('file-manager-config')
    if (saved) {
      try {
        const savedConfig = JSON.parse(saved)
        config.value = { ...config.value, ...savedConfig }
      } catch (error) {
        console.error('Failed to load config from localStorage:', error)
      }
    }
  }

  const resetConfig = () => {
    config.value = {
      apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
      apiKey: import.meta.env.VITE_API_KEY || '',
      maxFileSize: 100 * 1024 * 1024,
      allowedFileTypes: [
        'image/*',
        'text/*',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip',
        'audio/*',
        'video/*',
      ],
      uploadChunkSize: 1024 * 1024,
      theme: 'auto',
      language: 'zh-CN',
    }
    saveToLocalStorage()
  }

  // 初始化
  const init = () => {
    loadFromLocalStorage()
    applyTheme()

    // 监听系统主题变化
    if (config.value.theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQuery.addEventListener('change', applyTheme)
    }
  }

  return {
    // 状态
    config,

    // 计算属性
    apiBaseUrl,
    apiKey,
    maxFileSize,
    allowedFileTypes,
    uploadChunkSize,
    theme,
    language,
    maxFileSizeFormatted,

    // 方法
    updateConfig,
    updateApiConfig,
    updateTheme,
    updateLanguage,
    formatFileSize,
    resetConfig,
    init,
  }
})
