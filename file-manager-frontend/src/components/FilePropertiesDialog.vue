<template>
  <el-dialog
    v-model="visible"
    title="文件属性"
    width="900px"
    @close="handleClose"
    class="file-properties-dialog"
  >
    <div v-if="file" class="file-properties">
      <div class="properties-layout">
        <!-- 左侧：文件基本信息 -->
        <div class="left-panel">
          <div class="property-section">
            <h3>基本信息</h3>
            <div class="property-grid">
              <div class="property-item">
                <label>文件名：</label>
                <div class="filename-input-container">
                  <el-input
                    v-model="fileNameWithoutExt"
                    placeholder="请输入文件名"
                    size="small"
                    class="filename-input"
                  />
                  <span class="file-extension">{{ fileExtension }}</span>
                </div>
              </div>

              <div class="property-item">
                <label>文件大小：</label>
                <span class="property-value">{{ configStore.formatFileSize(file.size) }}</span>
              </div>

              <div class="property-item">
                <label>文件类型：</label>
                <span class="property-value">{{ file.mimeType }}</span>
              </div>

              <div class="property-item">
                <label>文件分类：</label>
                <span class="property-value">{{ getCategoryLabel(file.category) }}</span>
              </div>

              <div class="property-item">
                <label>访问级别：</label>
                <el-select v-model="formData.accessLevel" size="small">
                  <el-option
                    v-for="level in accessLevels"
                    :key="level.value"
                    :label="level.label"
                    :value="level.value"
                  />
                </el-select>
              </div>

              <div class="property-item">
                <label>上传时间：</label>
                <span class="property-value">{{ formatTime(file.uploadedAt) }}</span>
              </div>

              <div class="property-item">
                <label>文件路径：</label>
                <span class="property-value file-path">{{ file.path }}</span>
              </div>

              <div class="property-item url-item">
                <label>文件URL：</label>
                <div class="url-container">
                  <el-input :model-value="fullFileUrl" readonly size="small" class="url-input" />
                  <div class="url-actions">
                    <el-button
                      size="small"
                      @click="copyToClipboard(fullFileUrl)"
                      :icon="DocumentCopy"
                    >
                      复制
                    </el-button>
                    <el-button size="small" type="primary" @click="openFileUrl" :icon="Link">
                      打开
                    </el-button>
                  </div>
                </div>
              </div>

              <div v-if="file.checksum" class="property-item">
                <label>校验和：</label>
                <span class="checksum">{{ file.checksum }}</span>
              </div>
            </div>
          </div>

          <!-- 元数据 -->
          <div v-if="file.metadata || formData.metadata" class="property-section">
            <h3>元数据</h3>
            <el-input
              v-model="metadataText"
              type="textarea"
              :rows="4"
              placeholder="JSON格式的元数据"
            />
          </div>
        </div>

        <!-- 右侧：预览区域 -->
        <div v-if="isPreviewable" class="right-panel">
          <div class="property-section">
            <h3>预览</h3>
            <div class="preview-container">
              <img
                v-if="file.category === 'images'"
                :src="getPreviewUrl()"
                :alt="file.originalName || file.filename"
                class="preview-image"
                @error="handlePreviewError"
              />
              <div v-else class="preview-placeholder">
                <el-icon size="32"><Document /></el-icon>
                <p>此文件类型不支持预览</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Document, DocumentCopy, Link } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useConfigStore } from '@/stores/config'
import FilesApi from '@/api/files'
import { FileAccessLevel, type FileInfo } from '@/types/file'

interface Props {
  modelValue: boolean
  file: FileInfo | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  updated: []
}>()

const { t } = useI18n()
const configStore = useConfigStore()

// 状态
const saving = ref(false)
const formData = ref({
  filename: '',
  accessLevel: FileAccessLevel.PUBLIC,
  metadata: {} as Record<string, any>,
})
const metadataText = ref('')

// 计算属性
const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const accessLevels = computed(() => [
  { label: t('file.accessLevels.public'), value: FileAccessLevel.PUBLIC },
  { label: t('file.accessLevels.private'), value: FileAccessLevel.PRIVATE },
  { label: t('file.accessLevels.protected'), value: FileAccessLevel.PROTECTED },
])

const isPreviewable = computed(() => {
  return props.file?.category === 'images'
})

const fullFileUrl = computed(() => {
  if (!props.file) return ''
  return FilesApi.getFileDirectUrl(props.file.url)
})

// 文件扩展名
const fileExtension = computed(() => {
  if (!props.file) return ''
  const filename = props.file.originalName
  const lastDotIndex = filename.lastIndexOf('.')
  return lastDotIndex > 0 ? filename.substring(lastDotIndex) : ''
})

// 不带扩展名的文件名
const fileNameWithoutExt = ref('')

// 监听文件名变化，更新完整文件名
watch(fileNameWithoutExt, newName => {
  if (newName && fileExtension.value) {
    formData.value.filename = newName + fileExtension.value
  }
})

// 方法
const getCategoryLabel = (category: string) => {
  const categoryMap: Record<string, string> = {
    images: t('file.categories.images'),
    documents: t('file.categories.documents'),
    music: t('file.categories.music'),
    videos: t('file.categories.videos'),
    archives: t('file.categories.archives'),
  }
  return categoryMap[category] || category
}

const formatTime = (time: string) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

const getPreviewUrl = () => {
  return props.file ? FilesApi.getPreviewUrl(props.file.id) : ''
}

const handlePreviewError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败')
  }
}

const openFileUrl = () => {
  if (fullFileUrl.value) {
    window.open(fullFileUrl.value, '_blank')
  }
}

const initFormData = () => {
  if (props.file) {
    const originalName = props.file.originalName
    const lastDotIndex = originalName.lastIndexOf('.')
    const nameWithoutExt = lastDotIndex > 0 ? originalName.substring(0, lastDotIndex) : originalName

    // 设置不带扩展名的文件名
    fileNameWithoutExt.value = nameWithoutExt

    formData.value = {
      filename: originalName, // 使用原始文件名
      accessLevel: props.file.accessLevel,
      metadata: props.file.metadata || {},
    }
    metadataText.value = JSON.stringify(props.file.metadata || {}, null, 2)
  }
}

const handleSave = async () => {
  if (!props.file) return

  try {
    saving.value = true

    // 解析元数据
    let metadata: Record<string, any> | undefined
    if (metadataText.value.trim()) {
      try {
        metadata = JSON.parse(metadataText.value)
      } catch (error) {
        ElMessage.error('元数据格式错误，请检查JSON格式')
        return
      }
    }

    const updates = {
      filename: formData.value.filename,
      accessLevel: formData.value.accessLevel,
      metadata,
    }

    await FilesApi.updateFile(props.file.id, updates)
    ElMessage.success('文件属性更新成功')
    emit('updated')
  } catch (error) {
    ElMessage.error('更新失败')
  } finally {
    saving.value = false
  }
}

const handleClose = () => {
  visible.value = false
}

// 监听器
watch(() => props.file, initFormData, { immediate: true })
</script>

<style scoped>
/* 对话框整体样式 */
.file-properties-dialog :deep(.el-dialog__body) {
  padding: 16px 20px;
}

/* 全局隐藏滚动条样式 */
.file-properties-dialog :deep(*) {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.file-properties-dialog :deep(*)::-webkit-scrollbar {
  display: none; /* Chrome, Safari and Opera */
}

.file-properties {
  max-height: 70vh;
  overflow-y: auto;
  /* 隐藏滚动条但保持滚动功能 */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.file-properties::-webkit-scrollbar {
  display: none; /* Chrome, Safari and Opera */
}

/* 横向布局 */
.properties-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.left-panel {
  flex: 1;
  min-width: 0; /* 允许flex项目收缩 */
}

.right-panel {
  flex: 0 0 280px; /* 固定宽度的预览区域 */
}

.property-section {
  margin-bottom: 20px;
}

.property-section:last-child {
  margin-bottom: 0;
}

.property-section h3 {
  margin: 0 0 12px 0;
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 600;
  border-bottom: 1px solid var(--el-border-color-light);
  padding-bottom: 6px;
}

.property-grid {
  display: grid;
  gap: 10px;
}

.property-item {
  display: grid;
  grid-template-columns: 85px 1fr;
  align-items: center;
  gap: 10px;
  min-height: 30px;
}

.property-item label {
  font-weight: 500;
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.property-value {
  color: var(--el-text-color-primary);
  font-size: 13px;
  word-break: break-word;
}

.file-path {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.url-item {
  grid-template-columns: 90px 1fr;
  align-items: flex-start;
}

.url-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.url-input {
  flex: 1;
}

.url-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* 文件名输入样式 */
.filename-input-container {
  display: flex;
  align-items: center;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  overflow: hidden;
  background-color: var(--el-bg-color);
}

.filename-input {
  flex: 1;
}

.filename-input :deep(.el-input__wrapper) {
  border: none;
  box-shadow: none;
  border-radius: 0;
}

.file-extension {
  padding: 0 12px;
  background-color: var(--el-bg-color-page);
  color: var(--el-text-color-regular);
  font-size: 13px;
  border-left: 1px solid var(--el-border-color-light);
  white-space: nowrap;
}

.checksum {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 11px;
  word-break: break-all;
  color: var(--el-text-color-secondary);
  background-color: var(--el-bg-color-page);
  padding: 4px 8px;
  border-radius: 4px;
}

.preview-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background-color: var(--el-bg-color-page);
  overflow: hidden;
}

.preview-image {
  max-width: 260px;
  max-height: 180px;
  border-radius: 4px;
  object-fit: contain;
}

.preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-placeholder);
}

.preview-placeholder p {
  margin: 0;
  font-size: 13px;
}

/* 对话框底部按钮样式 */
.file-properties-dialog :deep(.el-dialog__footer) {
  padding: 12px 20px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

/* 元数据文本框样式 */
.property-section :deep(.el-textarea__inner) {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.4;
  /* 隐藏滚动条 */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.property-section :deep(.el-textarea__inner)::-webkit-scrollbar {
  display: none; /* Chrome, Safari and Opera */
}

/* 响应式调整 */
@media (max-width: 1024px) {
  .file-properties-dialog {
    width: 95% !important;
  }

  .properties-layout {
    flex-direction: column;
    gap: 16px;
  }

  .right-panel {
    flex: none;
    width: 100%;
  }

  .preview-container {
    height: 160px;
  }

  .preview-image {
    max-width: 200px;
    max-height: 140px;
  }
}

@media (max-width: 768px) {
  .property-item {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .property-item label {
    font-weight: 600;
  }

  .url-item {
    grid-template-columns: 1fr;
  }
}
</style>
