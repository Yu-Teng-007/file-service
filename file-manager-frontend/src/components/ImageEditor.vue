<template>
  <div class="image-editor">
    <el-dialog
      v-model="visible"
      :title="$t('imageEditor.title')"
      width="80%"
      :before-close="handleClose"
      destroy-on-close
    >
      <div class="editor-container">
        <!-- 工具栏 -->
        <div class="toolbar">
          <div class="toolbar-section">
            <span class="section-title">{{ $t('imageEditor.resize') }}</span>
            <el-input-number
              v-model="options.resize.width"
              :min="1"
              :max="5000"
              :placeholder="$t('imageEditor.width')"
              size="small"
              style="width: 100px"
            />
            <span>×</span>
            <el-input-number
              v-model="options.resize.height"
              :min="1"
              :max="5000"
              :placeholder="$t('imageEditor.height')"
              size="small"
              style="width: 100px"
            />
            <el-select v-model="options.resize.fit" size="small" style="width: 100px">
              <el-option label="Cover" value="cover" />
              <el-option label="Contain" value="contain" />
              <el-option label="Fill" value="fill" />
              <el-option label="Inside" value="inside" />
              <el-option label="Outside" value="outside" />
            </el-select>
          </div>

          <el-divider direction="vertical" />

          <div class="toolbar-section">
            <span class="section-title">{{ $t('imageEditor.compress') }}</span>
            <el-slider
              v-model="options.compress.quality"
              :min="1"
              :max="100"
              :step="1"
              style="width: 120px"
            />
            <span class="quality-text">{{ options.compress.quality }}%</span>
          </div>

          <el-divider direction="vertical" />

          <div class="toolbar-section">
            <span class="section-title">{{ $t('imageEditor.format') }}</span>
            <el-select v-model="options.format" size="small" style="width: 100px">
              <el-option label="JPEG" value="jpeg" />
              <el-option label="PNG" value="png" />
              <el-option label="WebP" value="webp" />
              <el-option label="AVIF" value="avif" />
            </el-select>
          </div>

          <el-divider direction="vertical" />

          <div class="toolbar-section">
            <el-checkbox v-model="options.stripMetadata">
              {{ $t('imageEditor.stripMetadata') }}
            </el-checkbox>
          </div>
        </div>

        <!-- 预览区域 -->
        <div class="preview-container">
          <div class="preview-panel">
            <h4>{{ $t('imageEditor.original') }}</h4>
            <div class="image-container">
              <img
                v-if="originalImageUrl"
                :src="originalImageUrl"
                :alt="$t('imageEditor.originalImage')"
                class="preview-image"
              />
              <div v-else class="image-placeholder">
                <el-icon size="48"><Picture /></el-icon>
                <p>{{ $t('imageEditor.noImage') }}</p>
              </div>
            </div>
            <div class="image-info">
              <p v-if="originalInfo">
                {{ $t('imageEditor.size') }}: {{ originalInfo.width }} × {{ originalInfo.height }}
              </p>
              <p v-if="originalFile">
                {{ $t('imageEditor.fileSize') }}: {{ formatFileSize(originalFile.size) }}
              </p>
            </div>
          </div>

          <div class="preview-panel">
            <h4>{{ $t('imageEditor.processed') }}</h4>
            <div class="image-container">
              <img
                v-if="processedImageUrl"
                :src="processedImageUrl"
                :alt="$t('imageEditor.processedImage')"
                class="preview-image"
                @error="handleImageError"
                @load="handleImageLoad"
              />
              <div v-else class="image-placeholder">
                <el-icon size="48"><Picture /></el-icon>
                <p>{{ $t('imageEditor.clickProcess') }}</p>
              </div>
            </div>
            <div class="image-info">
              <p v-if="processedInfo">
                {{ $t('imageEditor.size') }}: {{ processedInfo.width }} × {{ processedInfo.height }}
              </p>
              <p v-if="processedResult">
                {{ $t('imageEditor.fileSize') }}:
                {{ formatFileSize(processedResult.processedSize) }}
              </p>
              <p v-if="processedResult && processedResult.compressionRatio">
                {{ $t('imageEditor.compressionRatio') }}:
                {{ (processedResult.compressionRatio * 100).toFixed(1) }}%
              </p>
            </div>
          </div>
        </div>

        <!-- 水印设置 -->
        <div class="watermark-section">
          <el-collapse>
            <el-collapse-item :title="$t('imageEditor.watermark')" name="watermark">
              <div class="watermark-controls">
                <el-form :model="options.watermark" label-width="80px" size="small">
                  <el-form-item :label="$t('imageEditor.watermarkText')">
                    <el-input
                      v-model="options.watermark.text"
                      :placeholder="$t('imageEditor.watermarkTextPlaceholder')"
                    />
                  </el-form-item>
                  <el-form-item :label="$t('imageEditor.position')">
                    <el-select v-model="options.watermark.position">
                      <el-option label="Top Left" value="top-left" />
                      <el-option label="Top Right" value="top-right" />
                      <el-option label="Bottom Left" value="bottom-left" />
                      <el-option label="Bottom Right" value="bottom-right" />
                      <el-option label="Center" value="center" />
                    </el-select>
                  </el-form-item>
                  <el-form-item :label="$t('imageEditor.opacity')">
                    <el-slider v-model="options.watermark.opacity" :min="0" :max="1" :step="0.1" />
                  </el-form-item>
                </el-form>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="handleClose">
            {{ $t('common.cancel') }}
          </el-button>
          <el-button @click="handlePreview" :loading="processing">
            {{ $t('imageEditor.preview') }}
          </el-button>
          <el-button
            type="primary"
            @click="handleSave"
            :loading="saving"
            :disabled="!processedImageUrl"
          >
            {{ $t('imageEditor.save') }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Picture } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import FilesApi from '@/api/files'
import type { ImageProcessingOptions, ImageProcessingResult } from '@/types/file'

// Props and Emits
interface Props {
  modelValue: boolean
  file?: File
  fileId?: string
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved', result: ImageProcessingResult): void
}

const props = withDefaults(defineProps<Props>(), {
  file: undefined,
  fileId: undefined,
})

const emit = defineEmits<Emits>()

// Composables
const { t } = useI18n()

// Computed
const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

// State
const processing = ref(false)
const saving = ref(false)
const originalImageUrl = ref('')
const processedImageUrl = ref('')
const originalFile = ref<File>()
const originalInfo = ref<any>()
const processedInfo = ref<any>()
const processedResult = ref<ImageProcessingResult>()

// Options
const options = reactive<ImageProcessingOptions>({
  resize: {
    width: undefined,
    height: undefined,
    fit: 'cover',
  },
  compress: {
    quality: 80,
    progressive: true,
  },
  watermark: {
    text: '',
    position: 'bottom-right',
    opacity: 0.5,
  },
  format: 'jpeg',
  stripMetadata: false,
})

// Methods
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const loadOriginalImage = async () => {
  if (props.file) {
    originalFile.value = props.file
    originalImageUrl.value = URL.createObjectURL(props.file)

    // Get image dimensions
    const img = new Image()
    img.onload = () => {
      originalInfo.value = {
        width: img.width,
        height: img.height,
      }
      // Set default resize dimensions
      options.resize.width = img.width
      options.resize.height = img.height
    }
    img.src = originalImageUrl.value
  } else if (props.fileId) {
    try {
      // 获取文件信息和预览URL
      originalImageUrl.value = FilesApi.getPreviewUrl(props.fileId)

      // 从预览URL获取文件blob并转换为File对象
      const response = await fetch(originalImageUrl.value, {
        headers: {
          'x-api-key': import.meta.env.VITE_API_KEY,
        },
      })
      const blob = await response.blob()

      // 获取文件信息以获取原始文件名
      const fileInfo = await FilesApi.getFileInfo(props.fileId)
      originalFile.value = new File([blob], fileInfo.originalName, { type: blob.type })

      // Get image dimensions
      const img = new Image()
      img.onload = () => {
        originalInfo.value = {
          width: img.width,
          height: img.height,
        }
        // Set default resize dimensions
        options.resize.width = img.width
        options.resize.height = img.height
      }
      img.src = originalImageUrl.value
    } catch (error) {
      console.error('Failed to load image from fileId:', error)
      ElMessage.error(t('imageEditor.loadError'))
    }
  }
}

const handlePreview = async () => {
  if (!originalFile.value) {
    ElMessage.warning(t('imageEditor.noFileSelected'))
    return
  }

  try {
    processing.value = true

    // Clean up options - remove empty values
    const cleanOptions = { ...options }
    if (!cleanOptions.watermark?.text) {
      delete cleanOptions.watermark
    }
    if (!cleanOptions.resize?.width && !cleanOptions.resize?.height) {
      delete cleanOptions.resize
    }

    const result = await FilesApi.processImage(originalFile.value, cleanOptions)
    processedResult.value = result

    // 使用后端返回的处理后图片URL
    console.log('API Response:', result)
    if (result.processedUrl) {
      // 处理后的图片URL不需要/api前缀，因为它是静态文件
      const baseUrl = import.meta.env.VITE_API_BASE_URL.replace('/api', '')
      processedImageUrl.value = `${baseUrl}${result.processedUrl}`
      console.log('Processed image URL:', processedImageUrl.value)
    } else {
      console.error('No processedUrl in response:', result)
      ElMessage.error('处理后的图片URL缺失')
      return
    }
    processedInfo.value = result.info

    ElMessage.success(t('imageEditor.previewSuccess'))
  } catch (error) {
    console.error('Failed to process image:', error)
    ElMessage.error(t('imageEditor.previewError'))
  } finally {
    processing.value = false
  }
}

const handleImageError = (event: Event) => {
  console.error('Failed to load processed image:', event)
  console.error('Image URL:', processedImageUrl.value)
}

const handleImageLoad = () => {
  console.log('Processed image loaded successfully')
}

const handleSave = async () => {
  if (!processedResult.value || !processedResult.value.processedUrl) {
    ElMessage.warning(t('imageEditor.noProcessedImage'))
    return
  }

  try {
    saving.value = true

    // 生成保存的文件名
    const originalName = originalFile.value?.name || 'processed_image'
    const ext = originalName.split('.').pop() || 'jpg'
    const baseName = originalName.replace(`.${ext}`, '')
    const filename = `${baseName}_processed.${ext}`

    // 调用API保存处理后的图片
    const result = await FilesApi.saveProcessedImage(processedResult.value.processedUrl, filename)

    ElMessage.success(t('imageEditor.saveSuccess'))
    emit('saved', { ...processedResult.value, savedFile: result })
    handleClose()
  } catch (error) {
    console.error('Failed to save image:', error)
    ElMessage.error(t('imageEditor.saveError'))
  } finally {
    saving.value = false
  }
}

const handleClose = () => {
  // Clean up URLs
  if (originalImageUrl.value && originalImageUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(originalImageUrl.value)
  }
  if (processedImageUrl.value && processedImageUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(processedImageUrl.value)
  }

  visible.value = false
}

// Watch for file changes
watch(() => props.file, loadOriginalImage, { immediate: true })
watch(() => props.fileId, loadOriginalImage, { immediate: true })
</script>

<style scoped>
.image-editor {
  .editor-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background-color: var(--el-fill-color-lighter);
    border-radius: 8px;
    flex-wrap: wrap;
  }

  .toolbar-section {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-regular);
    white-space: nowrap;
  }

  .quality-text {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    min-width: 35px;
  }

  .preview-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    min-height: 400px;
  }

  .preview-panel {
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    padding: 16px;
  }

  .preview-panel h4 {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 500;
    text-align: center;
  }

  .image-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 300px;
    background-color: var(--el-fill-color-lighter);
    border-radius: 4px;
    margin-bottom: 16px;
  }

  .preview-image {
    max-width: 100%;
    max-height: 300px;
    object-fit: contain;
  }

  .image-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--el-text-color-secondary);
  }

  .image-info {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    text-align: center;
  }

  .image-info p {
    margin: 4px 0;
  }

  .watermark-section {
    border-top: 1px solid var(--el-border-color-light);
    padding-top: 16px;
  }

  .watermark-controls {
    padding: 16px 0;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}

:deep(.el-dialog__body) {
  padding: 20px;
}

:deep(.el-collapse-item__header) {
  font-weight: 500;
}
</style>
