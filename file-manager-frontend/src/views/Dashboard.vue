<template>
  <div class="dashboard">
    <div class="page-header">
      <h1>{{ $t('dashboard.title') }}</h1>
      <p>文件管理系统概览</p>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon">
            <el-icon size="32" color="#409EFF"><Folder /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ formatNumber(stats.totalFiles) }}</div>
            <div class="stat-label">{{ $t('dashboard.totalFiles') }}</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon">
            <el-icon size="32" color="#67C23A"><DataBoard /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ formatFileSize(stats.totalSize) }}</div>
            <div class="stat-label">{{ $t('dashboard.totalSize') }}</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon">
            <el-icon size="32" color="#E6A23C"><PieChart /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ diskUsagePercent }}%</div>
            <div class="stat-label">{{ $t('dashboard.diskUsage') }}</div>
          </div>
        </div>
      </el-card>

      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon">
            <el-icon size="32" color="#F56C6C"><Clock /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ formatUptime(stats.uptime) }}</div>
            <div class="stat-label">{{ $t('dashboard.uptime') }}</div>
          </div>
        </div>
      </el-card>
    </div>

    <div class="content-grid">
      <!-- 磁盘使用情况 -->
      <el-card class="disk-usage-card">
        <template #header>
          <div class="card-header">
            <span>磁盘使用情况</span>
            <el-button size="small" text @click="loadStats">
              <el-icon><Refresh /></el-icon>
            </el-button>
          </div>
        </template>

        <div class="disk-usage">
          <div class="usage-info">
            <div class="usage-item">
              <span class="label">已使用：</span>
              <span class="value">{{ formatFileSize(stats.diskUsage.used) }}</span>
            </div>
            <div class="usage-item">
              <span class="label">可用：</span>
              <span class="value">{{ formatFileSize(stats.diskUsage.free) }}</span>
            </div>
            <div class="usage-item">
              <span class="label">总计：</span>
              <span class="value">{{ formatFileSize(stats.diskUsage.total) }}</span>
            </div>
          </div>

          <div class="usage-progress">
            <el-progress
              :percentage="diskUsagePercent"
              :color="getDiskUsageColor(diskUsagePercent)"
              :stroke-width="12"
            />
          </div>
        </div>
      </el-card>

      <!-- 文件分类统计 -->
      <el-card class="category-stats-card">
        <template #header>
          <span>文件分类统计</span>
        </template>

        <div class="category-stats">
          <div v-for="category in categoryStats" :key="category.name" class="category-item">
            <div class="category-info">
              <el-icon class="category-icon" :style="{ color: category.color }">
                <component :is="category.icon" />
              </el-icon>
              <span class="category-name">{{ category.label }}</span>
            </div>
            <div class="category-count">{{ category.count }}</div>
          </div>
        </div>
      </el-card>

      <!-- 最近上传的文件 -->
      <el-card class="recent-files-card">
        <template #header>
          <div class="card-header">
            <span>{{ $t('dashboard.recentFiles') }}</span>
            <el-button size="small" text @click="$router.push('/files')">查看全部</el-button>
          </div>
        </template>

        <div v-loading="loadingRecentFiles" class="recent-files">
          <div v-for="file in recentFiles" :key="file.id" class="recent-file-item">
            <div class="file-icon">
              <el-icon size="20">
                <Document v-if="file.category === 'documents'" />
                <Picture v-else-if="file.category === 'images'" />
                <VideoPlay v-else-if="file.category === 'videos'" />
                <Headset v-else-if="file.category === 'music'" />
                <Document v-else />
              </el-icon>
            </div>

            <div class="file-info">
              <div class="file-name" :title="file.originalName">
                {{ file.originalName }}
              </div>
              <div class="file-meta">
                <span>{{ formatFileSize(file.size) }}</span>
                <span>{{ formatTime(file.uploadedAt) }}</span>
              </div>
            </div>

            <div class="file-actions">
              <el-button size="small" text @click="previewFile(file)">预览</el-button>
            </div>
          </div>

          <div v-if="recentFiles.length === 0" class="empty-state">
            <el-icon size="48" color="#C0C4CC"><Document /></el-icon>
            <p>暂无文件</p>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

import {
  Folder,
  DataBoard,
  PieChart,
  Clock,
  Refresh,
  Document,
  Picture,
  VideoPlay,
  Headset,
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useConfigStore } from '@/stores/config'
import FilesApi from '@/api/files'
import type { FileInfo } from '@/types/file'
import type { SystemInfo } from '@/types/config'

const configStore = useConfigStore()

// 状态
const loadingRecentFiles = ref(false)
const stats = ref<SystemInfo>({
  version: '1.0.0',
  uptime: 0,
  totalFiles: 0,
  totalSize: 0,
  diskUsage: {
    used: 0,
    total: 0,
    free: 0,
  },
})
const recentFiles = ref<FileInfo[]>([])

// 计算属性
const diskUsagePercent = computed(() => {
  if (stats.value.diskUsage.total === 0) return 0
  return Math.round((stats.value.diskUsage.used / stats.value.diskUsage.total) * 100)
})

const categoryStats = computed(() => [
  {
    name: 'images',
    label: '图片',
    icon: Picture,
    color: '#409EFF',
    count: recentFiles.value.filter(f => f.category === 'images').length,
  },
  {
    name: 'documents',
    label: '文档',
    icon: Document,
    color: '#67C23A',
    count: recentFiles.value.filter(f => f.category === 'documents').length,
  },
  {
    name: 'videos',
    label: '视频',
    icon: VideoPlay,
    color: '#E6A23C',
    count: recentFiles.value.filter(f => f.category === 'videos').length,
  },
  {
    name: 'music',
    label: '音频',
    icon: Headset,
    color: '#F56C6C',
    count: recentFiles.value.filter(f => f.category === 'music').length,
  },
])

// 方法
const formatNumber = (num: number): string => {
  return num.toLocaleString()
}

const formatFileSize = (bytes: number): string => {
  return configStore.formatFileSize(bytes)
}

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) {
    return `${days}天 ${hours}小时`
  } else if (hours > 0) {
    return `${hours}小时 ${minutes}分钟`
  } else {
    return `${minutes}分钟`
  }
}

const formatTime = (time: string): string => {
  return dayjs(time).format('MM-DD HH:mm')
}

const getDiskUsageColor = (percent: number): string => {
  if (percent < 70) return '#67C23A'
  if (percent < 90) return '#E6A23C'
  return '#F56C6C'
}

const loadStats = async () => {
  try {
    // 模拟系统统计数据
    // 在实际应用中，这里应该调用真实的API
    stats.value = {
      version: '1.0.0',
      uptime: Math.floor(Math.random() * 86400 * 7), // 随机7天内的运行时间
      totalFiles: Math.floor(Math.random() * 1000) + 100,
      totalSize: Math.floor(Math.random() * 1024 * 1024 * 1024 * 10), // 随机10GB内
      diskUsage: {
        total: 1024 * 1024 * 1024 * 100, // 100GB
        used: Math.floor(Math.random() * 1024 * 1024 * 1024 * 50), // 随机50GB内
        free: 0,
      },
    }
    stats.value.diskUsage.free = stats.value.diskUsage.total - stats.value.diskUsage.used
  } catch (error) {
    console.error('Failed to load stats:', error)
  }
}

const loadRecentFiles = async () => {
  try {
    loadingRecentFiles.value = true
    const response = await FilesApi.getFileList({
      page: 1,
      limit: 10,
      sortBy: 'uploadedAt',
      sortOrder: 'desc',
    })
    recentFiles.value = response.files
  } catch (error) {
    console.error('Failed to load recent files:', error)
  } finally {
    loadingRecentFiles.value = false
  }
}

const previewFile = (file: FileInfo) => {
  const previewUrl = FilesApi.getPreviewUrl(file.id)
  window.open(previewUrl, '_blank')
}

// 生命周期
onMounted(() => {
  loadStats()
  loadRecentFiles()
})
</script>

<style scoped>
.dashboard {
  height: calc(100vh - 60px);
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
  overflow-y: auto;
}

.page-header {
  margin-bottom: 20px;
  flex-shrink: 0;
}

.page-header h1 {
  margin: 0 0 8px 0;
  color: var(--el-text-color-primary);
}

.page-header p {
  margin: 0;
  color: var(--el-text-color-regular);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  border: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  flex-shrink: 0;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  height: calc(100vh - 300px);
  min-height: 400px;
}

.disk-usage-card,
.category-stats-card {
  grid-column: span 1;
  overflow: hidden;
}

.recent-files-card {
  grid-column: span 2;
  overflow: hidden;
}

.recent-files-card :deep(.el-card__body) {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.disk-usage {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.usage-info {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
}

.usage-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.usage-item .label {
  color: var(--el-text-color-regular);
}

.usage-item .value {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.category-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.category-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.category-name {
  color: var(--el-text-color-primary);
}

.category-count {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.recent-files {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.recent-file-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.recent-file-item:last-child {
  border-bottom: none;
}

.file-icon {
  margin-right: 12px;
  color: var(--el-color-primary);
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.file-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: flex;
  gap: 12px;
}

.file-actions {
  flex-shrink: 0;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--el-text-color-secondary);
}

.empty-state p {
  margin: 12px 0 0 0;
}

@media (max-width: 768px) {
  .content-grid {
    grid-template-columns: 1fr;
  }

  .recent-files-card {
    grid-column: span 1;
  }

  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
}
</style>
