<template>
  <div class="file-upload">
    <!-- 拖拽上传区域 -->
    <div
      ref="dropZone"
      class="upload-area"
      :class="{
        'is-dragover': isDragOver,
        'is-disabled': disabled || uploading,
      }"
      @click="handleClick"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
    >
      <el-icon class="upload-icon" size="48">
        <Upload />
      </el-icon>

      <div class="upload-text">
        <p class="primary-text">{{ $t('upload.dragHere') }}</p>
        <p class="secondary-text">
          {{ $t('upload.or') }}
          <span class="link-text">{{ $t('upload.clickToSelect') }}</span>
        </p>
      </div>

      <div class="upload-tips">
        <p>{{ $t('upload.maxSize') }}: {{ configStore.maxFileSizeFormatted }}</p>
        <p>{{ $t('upload.allowedTypes') }}: {{ allowedTypesText }}</p>
      </div>
    </div>

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInput"
      type="file"
      :multiple="multiple"
      :accept="accept"
      :disabled="disabled || uploading"
      @change="handleFileSelect"
      style="display: none"
    />

    <!-- 上传选项 -->
    <div v-if="showOptions" class="upload-options">
      <el-form :model="uploadOptions" label-width="100px" size="small">
        <el-form-item :label="$t('file.category')">
          <el-select v-model="uploadOptions.category" placeholder="自动检测">
            <el-option
              v-for="category in categories"
              :key="category.value"
              :label="category.label"
              :value="category.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item :label="$t('file.accessLevel')">
          <el-select v-model="uploadOptions.accessLevel">
            <el-option
              v-for="level in accessLevels"
              :key="level.value"
              :label="level.label"
              :value="level.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="自定义路径">
          <el-input v-model="uploadOptions.customPath" placeholder="可选，留空则自动生成" />
        </el-form-item>

        <el-form-item label="覆盖同名文件">
          <el-switch v-model="uploadOptions.overwrite" />
        </el-form-item>
      </el-form>
    </div>

    <!-- 上传队列 -->
    <div v-if="fileQueue.length > 0" class="upload-queue">
      <div class="queue-header">
        <h4>{{ $t('upload.uploadQueue') }} ({{ fileQueue.length }})</h4>
        <div class="queue-actions">
          <el-button
            v-if="!uploading"
            type="primary"
            size="small"
            :disabled="fileQueue.length === 0"
            @click="startUpload"
          >
            {{ $t('upload.startUpload') }}
          </el-button>

          <el-button v-else type="warning" size="small" @click="pauseUpload">
            {{ $t('upload.pauseUpload') }}
          </el-button>

          <el-button size="small" :disabled="uploading" @click="clearQueue">
            {{ $t('upload.clearQueue') }}
          </el-button>
        </div>
      </div>

      <div class="file-list">
        <div v-for="(file, index) in fileQueue" :key="index" class="file-item">
          <div class="file-info">
            <el-icon class="file-icon">
              <Document />
            </el-icon>
            <div class="file-details">
              <div class="file-name">{{ file.name }}</div>
              <div class="file-size">{{ formatFileSize(file.size) }}</div>
            </div>
          </div>

          <div class="file-progress">
            <el-progress
              v-if="file.progress !== undefined"
              :percentage="file.progress"
              :status="file.status === 'error' ? 'exception' : undefined"
              :stroke-width="4"
            />
          </div>

          <div class="file-actions">
            <el-button v-if="!uploading" size="small" text type="danger" @click="removeFile(index)">
              {{ $t('upload.removeFile') }}
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Upload, Document } from '@element-plus/icons-vue'
import { useConfigStore } from '@/stores/config'
import { useFilesStore } from '@/stores/files'
import { FileCategory, FileAccessLevel } from '@/types/file'

interface Props {
  multiple?: boolean
  accept?: string
  disabled?: boolean
  showOptions?: boolean
  autoUpload?: boolean
}

interface FileItem extends File {
  progress?: number
  status?: 'waiting' | 'uploading' | 'success' | 'error'
  error?: string
}

const props = withDefaults(defineProps<Props>(), {
  multiple: true,
  accept: '*/*',
  disabled: false,
  showOptions: true,
  autoUpload: false,
})

const emit = defineEmits<{
  success: [files: FileItem[]]
  error: [error: any]
  progress: [progress: number]
}>()

const { t } = useI18n()
const configStore = useConfigStore()
const filesStore = useFilesStore()

// 引用
const dropZone = ref<HTMLElement>()
const fileInput = ref<HTMLInputElement>()

// 状态
const isDragOver = ref(false)
const uploading = ref(false)
const fileQueue = ref<FileItem[]>([])

// 上传选项
const uploadOptions = ref({
  category: undefined as FileCategory | undefined,
  accessLevel: FileAccessLevel.PUBLIC,
  customPath: '',
  overwrite: false,
})

// 计算属性
const categories = computed(() => [
  { label: t('file.categories.images'), value: FileCategory.IMAGE },
  { label: t('file.categories.documents'), value: FileCategory.DOCUMENT },
  { label: t('file.categories.music'), value: FileCategory.MUSIC },
  { label: t('file.categories.videos'), value: FileCategory.VIDEO },
  { label: t('file.categories.archives'), value: FileCategory.ARCHIVE },
])

const accessLevels = computed(() => [
  { label: t('file.accessLevels.public'), value: FileAccessLevel.PUBLIC },
  { label: t('file.accessLevels.private'), value: FileAccessLevel.PRIVATE },
  { label: t('file.accessLevels.protected'), value: FileAccessLevel.PROTECTED },
])

const allowedTypesText = computed(() => {
  return configStore.allowedFileTypes.join(', ')
})

// 方法
const formatFileSize = (bytes: number): string => {
  return configStore.formatFileSize(bytes)
}

const validateFile = (file: File): boolean => {
  // 检查文件大小
  if (file.size > configStore.maxFileSize) {
    ElMessage.error(`文件 ${file.name} 大小超出限制`)
    return false
  }

  // 检查文件类型
  const isAllowed = configStore.allowedFileTypes.some(type => {
    if (type === '*/*') return true
    if (type.endsWith('/*')) {
      return file.type.startsWith(type.slice(0, -1))
    }
    return file.type === type
  })

  if (!isAllowed) {
    ElMessage.error(`文件 ${file.name} 类型不支持`)
    return false
  }

  return true
}

const addFilesToQueue = (files: File[]) => {
  const validFiles = files.filter(validateFile)

  validFiles.forEach(file => {
    const fileItem: FileItem = Object.assign(file, {
      status: 'waiting' as const,
    })
    fileQueue.value.push(fileItem)
  })

  if (props.autoUpload && validFiles.length > 0) {
    startUpload()
  }
}

const handleClick = () => {
  if (props.disabled || uploading.value) return
  fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files || [])
  addFilesToQueue(files)
  target.value = '' // 清空输入框
}

const handleDragEnter = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = true
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
}

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault()
  if (!dropZone.value?.contains(event.relatedTarget as Node)) {
    isDragOver.value = false
  }
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = false

  if (props.disabled || uploading.value) return

  const files = Array.from(event.dataTransfer?.files || [])
  addFilesToQueue(files)
}

const removeFile = (index: number) => {
  fileQueue.value.splice(index, 1)
}

const clearQueue = () => {
  if (uploading.value) return
  fileQueue.value = []
}

const startUpload = async () => {
  if (fileQueue.value.length === 0) return

  uploading.value = true
  const successFiles: FileItem[] = []

  try {
    for (let i = 0; i < fileQueue.value.length; i++) {
      const file = fileQueue.value[i]
      file.status = 'uploading'

      try {
        await filesStore.uploadFile(
          file,
          {
            category: uploadOptions.value.category,
            accessLevel: uploadOptions.value.accessLevel,
            customPath: uploadOptions.value.customPath || undefined,
            overwrite: uploadOptions.value.overwrite,
          },
          progress => {
            file.progress = progress
          }
        )

        file.status = 'success'
        file.progress = 100
        successFiles.push(file)
      } catch (error) {
        file.status = 'error'
        file.error = error instanceof Error ? error.message : '上传失败'
        emit('error', error)
      }
    }

    if (successFiles.length > 0) {
      emit('success', successFiles)
      ElMessage.success(`成功上传 ${successFiles.length} 个文件`)
    }
  } finally {
    uploading.value = false

    // 清除成功上传的文件
    setTimeout(() => {
      fileQueue.value = fileQueue.value.filter(f => f.status !== 'success')
    }, 2000)
  }
}

const pauseUpload = () => {
  uploading.value = false
  // 重置正在上传的文件状态
  fileQueue.value.forEach(file => {
    if (file.status === 'uploading') {
      file.status = 'waiting'
      file.progress = 0
    }
  })
}

// 生命周期
onMounted(() => {
  // 阻止页面默认的拖拽行为
  document.addEventListener('dragover', e => e.preventDefault())
  document.addEventListener('drop', e => e.preventDefault())
})

onUnmounted(() => {
  document.removeEventListener('dragover', e => e.preventDefault())
  document.removeEventListener('drop', e => e.preventDefault())
})
</script>

<style scoped>
.file-upload {
  width: 100%;
}

.upload-area {
  border: 2px dashed var(--el-border-color);
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background-color: var(--el-bg-color);
}

.upload-area:hover {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}

.upload-area.is-dragover {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-8);
}

.upload-area.is-disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.upload-icon {
  color: var(--el-color-primary);
  margin-bottom: 16px;
}

.upload-text {
  margin-bottom: 16px;
}

.primary-text {
  font-size: 16px;
  color: var(--el-text-color-primary);
  margin: 0 0 8px 0;
}

.secondary-text {
  font-size: 14px;
  color: var(--el-text-color-regular);
  margin: 0;
}

.link-text {
  color: var(--el-color-primary);
  cursor: pointer;
}

.upload-tips {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.upload-tips p {
  margin: 4px 0;
}

.upload-options {
  margin-top: 20px;
  padding: 20px;
  background-color: var(--el-bg-color-page);
  border-radius: 8px;
}

.upload-queue {
  margin-top: 20px;
}

.queue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color);
}

.queue-header h4 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.queue-actions {
  display: flex;
  gap: 8px;
}

.file-list {
  max-height: 300px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  margin-bottom: 8px;
  background-color: var(--el-bg-color);
}

.file-info {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.file-icon {
  margin-right: 12px;
  color: var(--el-color-primary);
}

.file-details {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-size {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}

.file-progress {
  flex: 0 0 200px;
  margin: 0 16px;
}

.file-actions {
  flex: 0 0 auto;
}
</style>
