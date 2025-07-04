<template>
  <div class="file-preview">
    <el-dialog
      v-model="visible"
      :title="previewTitle"
      :width="dialogWidth"
      :before-close="handleClose"
      destroy-on-close
      class="preview-dialog"
      center
    >
      <div class="preview-container">
        <!-- 加载状态 -->
        <div v-if="loading" class="loading-container">
          <el-icon class="is-loading" size="32"><Loading /></el-icon>
          <p>{{ $t('preview.loading') }}</p>
        </div>

        <!-- 错误状态 -->
        <div v-else-if="error" class="error-container">
          <el-icon size="48" color="var(--el-color-danger)"><WarningFilled /></el-icon>
          <p>{{ error }}</p>
          <el-button @click="loadPreview">{{ $t('common.retry') }}</el-button>
        </div>

        <!-- 预览内容 -->
        <div v-else class="preview-content">
          <!-- 图片预览 -->
          <div v-if="previewInfo?.type === 'image'" class="image-preview">
            <img
              :src="previewUrl"
              :alt="fileInfo?.filename"
              class="preview-image"
              :style="{
                transform: `scale(${imageScale}) rotate(${imageRotation}deg)`,
                maxWidth: '800px',
                maxHeight: '600px',
              }"
              @load="handleImageLoad"
              @error="handleImageError"
            />
            <div class="image-controls">
              <el-button-group>
                <el-tooltip content="放大" placement="top">
                  <el-button :icon="ZoomIn" @click="zoomIn" :disabled="imageScale >= 5" />
                </el-tooltip>
                <el-tooltip content="缩小" placement="top">
                  <el-button :icon="ZoomOut" @click="zoomOut" :disabled="imageScale <= 0.1" />
                </el-tooltip>
                <el-tooltip content="重置" placement="top">
                  <el-button :icon="Refresh" @click="resetImage" />
                </el-tooltip>
                <el-tooltip content="向左旋转" placement="top">
                  <el-button :icon="RefreshLeft" @click="rotateLeft" />
                </el-tooltip>
                <el-tooltip content="向右旋转" placement="top">
                  <el-button :icon="RefreshRight" @click="rotateRight" />
                </el-tooltip>
                <el-tooltip content="全屏" placement="top">
                  <el-button :icon="FullScreen" @click="toggleFullscreen" />
                </el-tooltip>
              </el-button-group>
              <span class="zoom-info">{{ Math.round(imageScale * 100) }}%</span>
            </div>
          </div>

          <!-- 视频预览 -->
          <div v-else-if="previewInfo?.type === 'video'" class="video-preview">
            <video
              :src="previewUrl"
              controls
              class="preview-video"
              @loadedmetadata="handleVideoLoad"
            >
              {{ $t('preview.videoNotSupported') }}
            </video>
          </div>

          <!-- 音频预览 -->
          <div v-else-if="previewInfo?.type === 'audio'" class="audio-preview">
            <div class="audio-container">
              <el-icon size="64" color="var(--el-color-primary)"><Headset /></el-icon>
              <h3>{{ fileInfo?.filename }}</h3>
              <audio
                :src="previewUrl"
                controls
                class="preview-audio"
                @loadedmetadata="handleAudioLoad"
              >
                {{ $t('preview.audioNotSupported') }}
              </audio>
            </div>
          </div>

          <!-- PDF预览 -->
          <div v-else-if="previewInfo?.type === 'pdf'" class="pdf-preview">
            <iframe :src="previewUrl" class="preview-pdf" frameborder="0"></iframe>
          </div>

          <!-- 文本预览 -->
          <div v-else-if="previewInfo?.type === 'text'" class="text-preview">
            <div class="text-controls">
              <el-select v-model="textEncoding" size="small" style="width: 120px">
                <el-option label="UTF-8" value="utf8" />
                <el-option label="GBK" value="gbk" />
                <el-option label="ASCII" value="ascii" />
              </el-select>
              <el-button size="small" @click="loadTextContent">
                {{ $t('preview.reload') }}
              </el-button>
            </div>
            <pre class="text-content">{{ textContent }}</pre>
          </div>

          <!-- 代码预览 -->
          <div v-else-if="previewInfo?.type === 'code'" class="code-preview">
            <div class="code-controls">
              <span class="language-tag">{{ codeLanguage }}</span>
              <el-button size="small" @click="copyCode">
                {{ $t('preview.copyCode') }}
              </el-button>
            </div>
            <pre class="code-content"><code v-html="highlightedCode"></code></pre>
          </div>

          <!-- Office文档预览 -->
          <div v-else-if="previewInfo?.type === 'office'" class="office-preview">
            <div class="office-placeholder">
              <el-icon size="64" color="var(--el-color-primary)"><Document /></el-icon>
              <h3>{{ fileInfo?.filename }}</h3>
              <p>{{ $t('preview.officeNotSupported') }}</p>
              <el-button type="primary" @click="downloadFile">
                {{ $t('preview.download') }}
              </el-button>
            </div>
          </div>

          <!-- 不支持的文件类型 -->
          <div v-else class="unsupported-preview">
            <el-icon size="64" color="var(--el-text-color-secondary)"><QuestionFilled /></el-icon>
            <h3>{{ $t('preview.unsupported') }}</h3>
            <p>{{ $t('preview.unsupportedDesc') }}</p>
            <el-button type="primary" @click="downloadFile">
              {{ $t('preview.download') }}
            </el-button>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="preview-footer">
          <div class="file-info">
            <span v-if="fileInfo">
              {{ $t('preview.fileSize') }}: {{ formatFileSize(fileInfo.size) }}
            </span>
            <span v-if="previewInfo?.metadata?.dimensions">
              {{ $t('preview.dimensions') }}: {{ previewInfo.metadata.dimensions.width }} ×
              {{ previewInfo.metadata.dimensions.height }}
            </span>
            <span v-if="previewInfo?.metadata?.duration">
              {{ $t('preview.duration') }}: {{ formatDuration(previewInfo.metadata.duration) }}
            </span>
          </div>
          <div class="preview-actions">
            <el-button @click="downloadFile">
              {{ $t('preview.download') }}
            </el-button>
            <el-button
              v-if="previewInfo?.canEdit && previewInfo?.type === 'image'"
              type="primary"
              @click="openImageEditor"
            >
              {{ $t('preview.edit') }}
            </el-button>
            <el-button @click="handleClose">
              {{ $t('common.close') }}
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <!-- 图片编辑器 -->
    <ImageEditor v-model="showImageEditor" :file-id="fileInfo?.id" @saved="handleImageSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Loading,
  WarningFilled,
  ZoomIn,
  ZoomOut,
  RefreshLeft,
  RefreshRight,
  FullScreen,
  Headset,
  Document,
  QuestionFilled,
  Refresh,
} from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import FilesApi from '@/api/files'
import ImageEditor from './ImageEditor.vue'
import type { FileInfo, FilePreviewInfo, ImageProcessingResult } from '@/types/file'

// Props and Emits
interface Props {
  modelValue: boolean
  fileInfo?: FileInfo
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'file-updated', file: FileInfo): void
}

const props = withDefaults(defineProps<Props>(), {
  fileInfo: undefined,
})

const emit = defineEmits<Emits>()

// Composables
const { t } = useI18n()

// Computed
const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const previewTitle = computed(() => {
  return props.fileInfo?.filename || t('preview.title')
})

// 响应式对话框宽度
const dialogWidth = computed(() => {
  if (typeof window === 'undefined') return '80%'

  const screenWidth = window.innerWidth

  // 根据屏幕宽度动态调整对话框宽度
  if (screenWidth >= 1920) {
    return '1200px' // 大屏幕：固定宽度
  } else if (screenWidth >= 1440) {
    return '1000px' // 中大屏幕
  } else if (screenWidth >= 1024) {
    return '800px' // 中等屏幕
  } else if (screenWidth >= 768) {
    return '90%' // 平板
  } else {
    return '95%' // 手机
  }
})

const previewUrl = computed(() => {
  if (!props.fileInfo) return ''
  return FilesApi.getPreviewUrl(props.fileInfo.id)
})

// State
const loading = ref(false)
const error = ref('')
const previewInfo = ref<FilePreviewInfo>()
const textContent = ref('')
const textEncoding = ref('utf8')
const highlightedCode = ref('')
const codeLanguage = ref('')
const showImageEditor = ref(false)

// Image controls
const imageScale = ref(1)
const imageRotation = ref(0)

// Methods
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

const loadPreview = async () => {
  if (!props.fileInfo) return

  try {
    loading.value = true
    error.value = ''

    previewInfo.value = await FilesApi.getFilePreviewInfo(props.fileInfo.id)

    // Load specific content based on type
    if (previewInfo.value.type === 'text' || previewInfo.value.type === 'code') {
      await loadTextContent()
    }
  } catch (err) {
    console.error('Failed to load preview:', err)
    error.value = t('preview.loadError')
  } finally {
    loading.value = false
  }
}

const loadTextContent = async () => {
  if (!props.fileInfo) return

  try {
    const result = await FilesApi.getFileContent(props.fileInfo.id, {
      mode: 'full',
      encoding: textEncoding.value,
      maxSize: 1024 * 1024, // 1MB limit
    })

    textContent.value = result.content

    if (previewInfo.value?.type === 'code') {
      // Detect language and highlight code
      codeLanguage.value = detectLanguage(props.fileInfo.filename)
      highlightedCode.value = highlightCode(result.content, codeLanguage.value)
    }
  } catch (err) {
    console.error('Failed to load text content:', err)
    textContent.value = t('preview.textLoadError')
  }
}

const detectLanguage = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase()
  const languageMap: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    vue: 'vue',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    php: 'php',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    sql: 'sql',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
  }
  return languageMap[ext || ''] || 'text'
}

const highlightCode = (code: string, language: string): string => {
  // This is a placeholder - you would integrate with a syntax highlighting library
  // like Prism.js or highlight.js
  return code.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const downloadFile = async () => {
  if (!props.fileInfo) return

  try {
    await FilesApi.downloadFile(props.fileInfo.id, props.fileInfo.filename)
  } catch (err) {
    console.error('Failed to download file:', err)
    ElMessage.error(t('preview.downloadError'))
  }
}

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(textContent.value)
    ElMessage.success(t('preview.codeCopied'))
  } catch (err) {
    console.error('Failed to copy code:', err)
    ElMessage.error(t('preview.copyError'))
  }
}

// Image controls
const zoomIn = () => {
  imageScale.value = Math.min(imageScale.value * 1.2, 5)
}

const zoomOut = () => {
  imageScale.value = Math.max(imageScale.value / 1.2, 0.1)
}

const resetImage = () => {
  imageScale.value = 1
  imageRotation.value = 0
}

const rotateLeft = () => {
  imageRotation.value -= 90
}

const rotateRight = () => {
  imageRotation.value += 90
}

const toggleFullscreen = () => {
  // Implement fullscreen functionality
}

const handleImageLoad = () => {
  // Image loaded successfully
}

const handleImageError = () => {
  error.value = t('preview.imageLoadError')
}

const handleVideoLoad = () => {
  // Video loaded successfully
}

const handleAudioLoad = () => {
  // Audio loaded successfully
}

const openImageEditor = () => {
  showImageEditor.value = true
}

const handleImageSaved = (result: ImageProcessingResult) => {
  ElMessage.success(t('preview.imageSaved'))
  // Refresh preview or emit update event
}

const handleClose = () => {
  visible.value = false
  // Reset state
  imageScale.value = 1
  imageRotation.value = 0
  textContent.value = ''
  highlightedCode.value = ''
  error.value = ''
}

// Watch for file changes
watch(() => props.fileInfo, loadPreview, { immediate: true })
watch(visible, newVisible => {
  if (newVisible && props.fileInfo) {
    nextTick(() => {
      loadPreview()
    })
  }
})
</script>

<style scoped>
.file-preview {
  .preview-dialog {
    :deep(.el-dialog) {
      margin-top: 8vh;
      margin-bottom: 8vh;
      max-height: 84vh;
      min-height: 400px;
      display: flex;
      flex-direction: column;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
    }

    :deep(.el-dialog__header) {
      padding: 16px 20px;
      border-bottom: 1px solid var(--el-border-color-lighter);

      .el-dialog__title {
        font-size: 16px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }
    }

    :deep(.el-dialog__body) {
      flex: 1;
      padding: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    :deep(.el-dialog__headerbtn) {
      top: 16px;
      right: 16px;
      width: 32px;
      height: 32px;

      .el-dialog__close {
        font-size: 16px;
        color: var(--el-text-color-secondary);

        &:hover {
          color: var(--el-text-color-primary);
        }
      }
    }
  }

  .preview-container {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .loading-container,
  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    flex: 1;
    gap: 16px;
  }

  .preview-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .image-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background-color: var(--el-fill-color-lighter);
    border-radius: 8px;
    margin: 16px;
    overflow: hidden;
    position: relative;
  }

  .preview-image {
    object-fit: contain;
    transition: transform 0.3s ease;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }

  .image-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-top: 16px;
    padding: 8px 16px;
    background-color: rgba(0, 0, 0, 0.05);
    border-radius: 20px;
    backdrop-filter: blur(8px);

    .el-button-group {
      .el-button {
        border-radius: 6px;
        padding: 8px;

        &:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
      }
    }
  }

  .zoom-info {
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    background-color: var(--el-color-primary-light-9);
    padding: 4px 8px;
    border-radius: 12px;
    min-width: 50px;
    text-align: center;
  }

  .video-preview,
  .audio-preview {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 16px;
    flex: 1;
    background-color: var(--el-fill-color-lighter);
    border-radius: 8px;
    margin: 16px;
  }

  .preview-video {
    max-width: calc(100% - 32px);
    max-height: calc(100% - 32px);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .audio-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .preview-audio {
    width: 400px;
  }

  .pdf-preview {
    height: 100%;
  }

  .preview-pdf {
    width: 100%;
    height: 100%;
  }

  .text-preview,
  .code-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px;
  }

  .text-controls,
  .code-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--el-border-color-light);
  }

  .language-tag {
    background-color: var(--el-color-primary);
    color: white;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .text-content,
  .code-content {
    flex: 1;
    overflow: auto;
    background-color: var(--el-fill-color-lighter);
    padding: 16px;
    border-radius: 4px;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 14px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .office-preview,
  .unsupported-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-height: 300px;
    gap: 16px;
    padding: 20px;
  }

  .preview-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-top: 1px solid var(--el-border-color-light);
  }

  .file-info {
    display: flex;
    gap: 16px;
    font-size: 14px;
    color: var(--el-text-color-secondary);
  }

  .preview-actions {
    display: flex;
    gap: 8px;
  }
}
</style>
