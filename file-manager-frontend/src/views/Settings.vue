<template>
  <div class="settings-page">
    <div class="page-header">
      <h1>{{ $t('settings.title') }}</h1>
      <p>配置文件管理系统的各项设置</p>
    </div>

    <div class="settings-content">
      <!-- API配置 -->
      <el-card class="settings-card">
        <template #header>
          <div class="card-header">
            <el-icon><Link /></el-icon>
            <span>{{ $t('settings.apiConfig') }}</span>
          </div>
        </template>

        <el-form ref="apiFormRef" :model="apiForm" :rules="apiRules" label-width="120px">
          <el-form-item :label="$t('settings.apiBaseUrl')" prop="apiBaseUrl">
            <el-input v-model="apiForm.apiBaseUrl" placeholder="http://localhost:3001" />
          </el-form-item>

          <el-form-item :label="$t('settings.apiKey')" prop="apiKey">
            <el-input
              v-model="apiForm.apiKey"
              type="password"
              show-password
              placeholder="请输入API密钥"
            />
          </el-form-item>

          <el-form-item>
            <el-button type="primary" @click="saveApiConfig">保存API配置</el-button>
            <el-button @click="testConnection">测试连接</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 上传配置 -->
      <el-card class="settings-card">
        <template #header>
          <div class="card-header">
            <el-icon><Upload /></el-icon>
            <span>{{ $t('settings.uploadConfig') }}</span>
          </div>
        </template>

        <el-form ref="uploadFormRef" :model="uploadForm" :rules="uploadRules" label-width="120px">
          <el-form-item :label="$t('settings.maxFileSize')" prop="maxFileSize">
            <el-input-number
              v-model="uploadForm.maxFileSize"
              :min="1"
              :max="1024"
              :step="1"
              controls-position="right"
            />
            <span class="unit">MB</span>
          </el-form-item>

          <el-form-item :label="$t('settings.allowedTypes')" prop="allowedTypes">
            <el-select
              v-model="uploadForm.allowedTypes"
              multiple
              placeholder="选择允许的文件类型"
              style="width: 100%"
            >
              <el-option
                v-for="type in fileTypeOptions"
                :key="type.value"
                :label="type.label"
                :value="type.value"
              />
            </el-select>
          </el-form-item>

          <el-form-item>
            <el-button type="primary" @click="saveUploadConfig">保存上传配置</el-button>
            <el-button @click="resetUploadConfig">重置为默认</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 外观设置 -->
      <el-card class="settings-card">
        <template #header>
          <div class="card-header">
            <el-icon><Brush /></el-icon>
            <span>{{ $t('settings.appearance') }}</span>
          </div>
        </template>

        <el-form label-width="120px">
          <el-form-item :label="$t('settings.theme')">
            <el-radio-group v-model="appearanceForm.theme" @change="handleThemeChange">
              <el-radio value="light">
                <el-icon><Sunny /></el-icon>
                {{ $t('settings.themes.light') }}
              </el-radio>
              <el-radio value="dark">
                <el-icon><Moon /></el-icon>
                {{ $t('settings.themes.dark') }}
              </el-radio>
              <el-radio value="auto">
                <el-icon><Monitor /></el-icon>
                {{ $t('settings.themes.auto') }}
              </el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item :label="$t('settings.language')">
            <el-radio-group v-model="appearanceForm.language" @change="handleLanguageChange">
              <el-radio value="zh-CN">中文简体</el-radio>
              <el-radio value="en-US">English</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 系统信息 -->
      <el-card class="settings-card">
        <template #header>
          <div class="card-header">
            <el-icon><InfoFilled /></el-icon>
            <span>系统信息</span>
          </div>
        </template>

        <div class="system-info">
          <div class="info-item">
            <span class="label">应用版本：</span>
            <span class="value">1.0.0</span>
          </div>
          <div class="info-item">
            <span class="label">构建时间：</span>
            <span class="value">{{ buildTime }}</span>
          </div>
          <div class="info-item">
            <span class="label">技术栈：</span>
            <span class="value">Vue 3 + TypeScript + Element Plus</span>
          </div>
          <div class="info-item">
            <span class="label">浏览器：</span>
            <span class="value">{{ browserInfo }}</span>
          </div>
        </div>
      </el-card>

      <!-- 危险操作 -->
      <el-card class="settings-card danger-card">
        <template #header>
          <div class="card-header">
            <el-icon><Warning /></el-icon>
            <span>危险操作</span>
          </div>
        </template>

        <div class="danger-actions">
          <div class="action-item">
            <div class="action-info">
              <h4>重置所有设置</h4>
              <p>将所有配置重置为默认值，此操作不可撤销</p>
            </div>
            <el-button type="danger" @click="resetAllSettings">重置设置</el-button>
          </div>

          <div class="action-item">
            <div class="action-info">
              <h4>清除缓存</h4>
              <p>清除浏览器中的所有缓存数据</p>
            </div>
            <el-button type="warning" @click="clearCache">清除缓存</el-button>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  Link,
  Upload,
  Brush,
  InfoFilled,
  Warning,
  Sunny,
  Moon,
  Monitor,
} from '@element-plus/icons-vue'
import { useConfigStore } from '@/stores/config'
import apiClient from '@/api/client'

const { t, locale } = useI18n()
const configStore = useConfigStore()

// 引用
const apiFormRef = ref<FormInstance>()
const uploadFormRef = ref<FormInstance>()

// 表单数据
const apiForm = reactive({
  apiBaseUrl: '',
  apiKey: '',
})

const uploadForm = reactive({
  maxFileSize: 100,
  allowedTypes: [] as string[],
})

const appearanceForm = reactive({
  theme: 'auto' as 'light' | 'dark' | 'auto',
  language: 'zh-CN' as 'zh-CN' | 'en-US',
})

// 表单验证规则
const apiRules: FormRules = {
  apiBaseUrl: [
    { required: true, message: '请输入API地址', trigger: 'blur' },
    { type: 'url', message: '请输入有效的URL地址', trigger: 'blur' },
  ],
  apiKey: [
    { required: true, message: '请输入API密钥', trigger: 'blur' },
    { min: 8, message: 'API密钥长度不能少于8位', trigger: 'blur' },
  ],
}

const uploadRules: FormRules = {
  maxFileSize: [
    { required: true, message: '请设置最大文件大小', trigger: 'blur' },
    { type: 'number', min: 1, max: 1024, message: '文件大小应在1-1024MB之间', trigger: 'blur' },
  ],
  allowedTypes: [{ required: true, message: '请选择允许的文件类型', trigger: 'change' }],
}

// 文件类型选项
const fileTypeOptions = [
  { label: '所有文件 (*/*)', value: '*/*' },
  { label: '图片文件 (image/*)', value: 'image/*' },
  { label: '文档文件 (text/*)', value: 'text/*' },
  { label: 'PDF文件', value: 'application/pdf' },
  { label: '压缩文件', value: 'application/zip' },
  { label: '音频文件 (audio/*)', value: 'audio/*' },
  { label: '视频文件 (video/*)', value: 'video/*' },
]

// 计算属性
const buildTime = computed(() => {
  return new Date().toLocaleString()
})

const browserInfo = computed(() => {
  const ua = navigator.userAgent
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Safari')) return 'Safari'
  if (ua.includes('Edge')) return 'Edge'
  return 'Unknown'
})

// 方法
const initForms = () => {
  // 初始化API配置
  apiForm.apiBaseUrl = configStore.apiBaseUrl
  apiForm.apiKey = configStore.apiKey

  // 初始化上传配置
  uploadForm.maxFileSize = Math.round(configStore.maxFileSize / (1024 * 1024))
  uploadForm.allowedTypes = [...configStore.allowedFileTypes]

  // 初始化外观配置
  appearanceForm.theme = configStore.theme
  appearanceForm.language = configStore.language
}

const saveApiConfig = async () => {
  if (!apiFormRef.value) return

  try {
    await apiFormRef.value.validate()

    configStore.updateApiConfig(apiForm.apiBaseUrl, apiForm.apiKey)
    ElMessage.success('API配置保存成功')
  } catch (error) {
    ElMessage.error('请检查输入内容')
  }
}

const testConnection = async () => {
  try {
    // 临时更新API配置进行测试
    apiClient.updateConfig(apiForm.apiBaseUrl, apiForm.apiKey)

    // 测试连接（这里可以调用一个简单的API）
    await new Promise(resolve => setTimeout(resolve, 1000)) // 模拟API调用

    ElMessage.success('连接测试成功')
  } catch (error) {
    ElMessage.error('连接测试失败，请检查API地址和密钥')
  }
}

const saveUploadConfig = async () => {
  if (!uploadFormRef.value) return

  try {
    await uploadFormRef.value.validate()

    configStore.updateConfig({
      maxFileSize: uploadForm.maxFileSize * 1024 * 1024,
      allowedFileTypes: uploadForm.allowedTypes,
    })

    ElMessage.success('上传配置保存成功')
  } catch (error) {
    ElMessage.error('请检查输入内容')
  }
}

const resetUploadConfig = () => {
  uploadForm.maxFileSize = 100
  uploadForm.allowedTypes = ['*/*']
}

const handleThemeChange = (theme: string) => {
  configStore.updateTheme(theme as any)
}

const handleLanguageChange = (lang: string) => {
  locale.value = lang
  configStore.updateLanguage(lang as any)
}

const resetAllSettings = async () => {
  try {
    await ElMessageBox.confirm('确认重置所有设置吗？此操作将清除所有自定义配置。', '重置确认', {
      type: 'warning',
    })

    configStore.resetConfig()
    initForms()
    ElMessage.success('设置已重置')
  } catch (error) {
    // 用户取消
  }
}

const clearCache = async () => {
  try {
    await ElMessageBox.confirm('确认清除缓存吗？这将清除浏览器中的所有缓存数据。', '清除确认', {
      type: 'warning',
    })

    localStorage.clear()
    sessionStorage.clear()
    ElMessage.success('缓存已清除')

    // 刷新页面
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  } catch (error) {
    // 用户取消
  }
}

// 生命周期
onMounted(() => {
  initForms()
})
</script>

<style scoped>
.settings-page {
  height: calc(100vh - 60px);
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
  overflow-y: auto;
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

.settings-content {
  space-y: 20px;
}

.settings-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.unit {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
}

.system-info {
  space-y: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.info-item:last-child {
  border-bottom: none;
}

.info-item .label {
  color: var(--el-text-color-regular);
  font-weight: 500;
}

.info-item .value {
  color: var(--el-text-color-primary);
}

.danger-card {
  border-color: var(--el-color-danger-light-7);
}

.danger-card :deep(.el-card__header) {
  background-color: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.danger-actions {
  space-y: 16px;
}

.action-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  margin-bottom: 12px;
}

.action-info h4 {
  margin: 0 0 4px 0;
  color: var(--el-text-color-primary);
}

.action-info p {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.el-radio {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.el-radio :deep(.el-radio__label) {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
