<template>
  <div class="upload-page">
    <div class="page-header">
      <h1>{{ $t('upload.title') }}</h1>
      <p>支持拖拽上传、批量上传，最大文件大小：{{ configStore.maxFileSizeFormatted }}</p>
    </div>

    <el-card class="upload-card">
      <FileUpload
        :multiple="true"
        :show-options="true"
        :auto-upload="false"
        @success="handleUploadSuccess"
        @error="handleUploadError"
      />
    </el-card>

    <!-- 上传进度 -->
    <el-card v-if="filesStore.uploadProgress.length > 0" class="progress-card">
      <template #header>
        <div class="card-header">
          <span>{{ $t('upload.uploadProgress') }}</span>
          <el-button size="small" text type="danger" @click="filesStore.clearUploadProgress">
            清除记录
          </el-button>
        </div>
      </template>

      <div class="progress-list">
        <div
          v-for="progress in filesStore.uploadProgress"
          :key="progress.fileId"
          class="progress-item"
        >
          <div class="progress-info">
            <div class="file-name">{{ progress.fileName }}</div>
            <div class="status-text" :class="progress.status">
              {{ getStatusText(progress.status) }}
            </div>
          </div>

          <div class="progress-bar">
            <el-progress
              :percentage="progress.progress"
              :status="
                progress.status === 'error'
                  ? 'exception'
                  : progress.status === 'success'
                    ? 'success'
                    : undefined
              "
              :stroke-width="6"
            />
          </div>

          <div v-if="progress.error" class="error-message">
            {{ progress.error }}
          </div>
        </div>
      </div>
    </el-card>

    <!-- 最近上传的文件 -->
    <el-card v-if="recentFiles.length > 0" class="recent-files-card">
      <template #header>
        <div class="card-header">
          <span>最近上传的文件</span>
          <el-button size="small" text @click="goToFileList">查看全部</el-button>
        </div>
      </template>

      <div class="recent-files-list">
        <div v-for="file in recentFiles" :key="file.id" class="recent-file-item">
          <div class="file-icon">
            <el-icon size="24">
              <Document v-if="file.category === 'documents'" />
              <Picture v-else-if="file.category === 'images'" />
              <VideoPlay v-else-if="file.category === 'videos'" />
              <Headset v-else-if="file.category === 'music'" />
              <Document v-else />
            </el-icon>
          </div>

          <div class="file-info">
            <div class="file-name">{{ file.originalName }}</div>
            <div class="file-meta">
              <span>{{ configStore.formatFileSize(file.size) }}</span>
              <span>{{ formatTime(file.uploadedAt) }}</span>
            </div>
          </div>

          <div class="file-actions">
            <el-button size="small" text @click="previewFile(file)">预览</el-button>
            <el-button size="small" text @click="downloadFile(file)">下载</el-button>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Document, Picture, VideoPlay, Headset } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import FileUpload from '@/components/FileUpload.vue'
import { useConfigStore } from '@/stores/config'
import { useFilesStore } from '@/stores/files'
import FilesApi from '@/api/files'
import type { FileInfo } from '@/types/file'

const router = useRouter()
const { t } = useI18n()
const configStore = useConfigStore()
const filesStore = useFilesStore()

// 状态
const recentFiles = ref<FileInfo[]>([])

// 计算属性
const getStatusText = (status: string) => {
  switch (status) {
    case 'uploading':
      return '上传中'
    case 'success':
      return '上传成功'
    case 'error':
      return '上传失败'
    default:
      return '等待中'
  }
}

// 方法
const handleUploadSuccess = (files: any[]) => {
  ElMessage.success(`成功上传 ${files.length} 个文件`)
  loadRecentFiles()
}

const handleUploadError = (error: any) => {
  console.error('Upload error:', error)
}

const loadRecentFiles = async () => {
  try {
    const response = await FilesApi.getFileList({
      page: 1,
      limit: 5,
      sortBy: 'uploadedAt',
      sortOrder: 'desc',
    })
    recentFiles.value = response.files
  } catch (error) {
    console.error('Failed to load recent files:', error)
  }
}

const formatTime = (time: string) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

const previewFile = (file: FileInfo) => {
  const previewUrl = FilesApi.getPreviewUrl(file.id)
  window.open(previewUrl, '_blank')
}

const downloadFile = async (file: FileInfo) => {
  try {
    await FilesApi.downloadFile(file.id, file.originalName)
  } catch (error) {
    ElMessage.error('下载失败')
  }
}

const goToFileList = () => {
  router.push('/files')
}

// 生命周期
onMounted(() => {
  loadRecentFiles()
})
</script>

<style scoped>
.upload-page {
  height: calc(100vh - 60px);
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
  overflow-y: auto;
  max-width: 1200px;
  margin: 0 auto;
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

.upload-card {
  margin-bottom: 20px;
  flex-shrink: 0;
}

.progress-card,
.recent-files-card {
  margin-bottom: 20px;
}

.recent-files-card {
  flex: 1;
  min-height: 300px;
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

.progress-list {
  space-y: 16px;
}

.progress-item {
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  margin-bottom: 12px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.file-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.status-text {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}

.status-text.uploading {
  background-color: var(--el-color-primary-light-8);
  color: var(--el-color-primary);
}

.status-text.success {
  background-color: var(--el-color-success-light-8);
  color: var(--el-color-success);
}

.status-text.error {
  background-color: var(--el-color-danger-light-8);
  color: var(--el-color-danger);
}

.progress-bar {
  margin-bottom: 8px;
}

.error-message {
  font-size: 12px;
  color: var(--el-color-danger);
}

.recent-files-list {
  space-y: 12px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.recent-file-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  margin-bottom: 8px;
  transition: all 0.3s;
}

.recent-file-item:hover {
  background-color: var(--el-bg-color-page);
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
  display: flex;
  gap: 8px;
}
</style>
