<template>
  <el-dialog
    v-model="visible"
    title="文件属性"
    width="600px"
    @close="handleClose"
  >
    <div v-if="file" class="file-properties">
      <!-- 文件基本信息 -->
      <div class="property-section">
        <h3>基本信息</h3>
        <div class="property-grid">
          <div class="property-item">
            <label>文件名：</label>
            <el-input
              v-model="formData.filename"
              placeholder="请输入文件名"
            />
          </div>
          
          <div class="property-item">
            <label>原始名称：</label>
            <span>{{ file.originalName }}</span>
          </div>
          
          <div class="property-item">
            <label>文件大小：</label>
            <span>{{ configStore.formatFileSize(file.size) }}</span>
          </div>
          
          <div class="property-item">
            <label>文件类型：</label>
            <span>{{ file.mimeType }}</span>
          </div>
          
          <div class="property-item">
            <label>文件分类：</label>
            <span>{{ getCategoryLabel(file.category) }}</span>
          </div>
          
          <div class="property-item">
            <label>访问级别：</label>
            <el-select v-model="formData.accessLevel">
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
            <span>{{ formatTime(file.uploadedAt) }}</span>
          </div>
          
          <div class="property-item">
            <label>文件路径：</label>
            <span>{{ file.path }}</span>
          </div>
          
          <div class="property-item">
            <label>文件URL：</label>
            <el-input
              :model-value="file.url"
              readonly
            >
              <template #append>
                <el-button @click="copyToClipboard(file.url)">
                  复制
                </el-button>
              </template>
            </el-input>
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
          :rows="6"
          placeholder="JSON格式的元数据"
        />
      </div>

      <!-- 预览 -->
      <div v-if="isPreviewable" class="property-section">
        <h3>预览</h3>
        <div class="preview-container">
          <img
            v-if="file.category === 'images'"
            :src="getPreviewUrl()"
            :alt="file.originalName"
            class="preview-image"
            @error="handlePreviewError"
          />
          <div v-else class="preview-placeholder">
            <el-icon size="48"><Document /></el-icon>
            <p>此文件类型不支持预览</p>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button
          type="primary"
          :loading="saving"
          @click="handleSave"
        >
          保存
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Document } from '@element-plus/icons-vue'
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
  set: (value) => emit('update:modelValue', value),
})

const accessLevels = computed(() => [
  { label: t('file.accessLevels.public'), value: FileAccessLevel.PUBLIC },
  { label: t('file.accessLevels.private'), value: FileAccessLevel.PRIVATE },
  { label: t('file.accessLevels.protected'), value: FileAccessLevel.PROTECTED },
])

const isPreviewable = computed(() => {
  return props.file?.category === 'images'
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

const initFormData = () => {
  if (props.file) {
    formData.value = {
      filename: props.file.filename,
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
.file-properties {
  max-height: 70vh;
  overflow-y: auto;
}

.property-section {
  margin-bottom: 24px;
}

.property-section h3 {
  margin: 0 0 16px 0;
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid var(--el-border-color);
  padding-bottom: 8px;
}

.property-grid {
  display: grid;
  gap: 16px;
}

.property-item {
  display: grid;
  grid-template-columns: 100px 1fr;
  align-items: center;
  gap: 12px;
}

.property-item label {
  font-weight: 500;
  color: var(--el-text-color-regular);
}

.checksum {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

.preview-container {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  background-color: var(--el-bg-color-page);
}

.preview-image {
  max-width: 100%;
  max-height: 300px;
  object-fit: contain;
  border-radius: 4px;
}

.preview-placeholder {
  color: var(--el-text-color-secondary);
}

.preview-placeholder p {
  margin: 8px 0 0 0;
}

.dialog-footer {
  text-align: right;
}
</style>
