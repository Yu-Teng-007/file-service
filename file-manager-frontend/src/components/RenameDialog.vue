<template>
  <el-dialog
    v-model="visible"
    title="重命名文件"
    width="400px"
    @close="handleClose"
  >
    <div v-if="file" class="rename-form">
      <div class="current-name">
        <label>当前文件名：</label>
        <span>{{ file.originalName }}</span>
      </div>
      
      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-width="80px"
      >
        <el-form-item label="新文件名" prop="filename">
          <el-input
            v-model="formData.filename"
            placeholder="请输入新的文件名"
            @keyup.enter="handleSave"
          />
        </el-form-item>
      </el-form>
      
      <div class="tips">
        <el-icon><InfoFilled /></el-icon>
        <span>重命名只会修改显示名称，不会影响文件的实际存储路径</span>
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
          确认
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { InfoFilled } from '@element-plus/icons-vue'
import FilesApi from '@/api/files'
import type { FileInfo } from '@/types/file'

interface Props {
  modelValue: boolean
  file: FileInfo | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  renamed: []
}>()

// 引用
const formRef = ref<FormInstance>()

// 状态
const saving = ref(false)
const formData = ref({
  filename: '',
})

// 计算属性
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// 表单验证规则
const rules: FormRules = {
  filename: [
    { required: true, message: '请输入文件名', trigger: 'blur' },
    { min: 1, max: 255, message: '文件名长度应在 1 到 255 个字符之间', trigger: 'blur' },
    {
      pattern: /^[^<>:"/\\|?*]+$/,
      message: '文件名不能包含以下字符：< > : " / \\ | ? *',
      trigger: 'blur',
    },
  ],
}

// 方法
const initFormData = () => {
  if (props.file) {
    formData.value.filename = props.file.originalName
  }
}

const handleSave = async () => {
  if (!props.file || !formRef.value) return

  try {
    // 验证表单
    await formRef.value.validate()
    
    // 检查是否有变化
    if (formData.value.filename === props.file.originalName) {
      ElMessage.info('文件名没有变化')
      return
    }

    saving.value = true

    await FilesApi.updateFile(props.file.id, {
      filename: formData.value.filename,
    })

    ElMessage.success('重命名成功')
    emit('renamed')
  } catch (error) {
    if (error !== false) { // 表单验证失败时返回 false
      ElMessage.error('重命名失败')
    }
  } finally {
    saving.value = false
  }
}

const handleClose = () => {
  visible.value = false
}

// 监听器
watch(() => props.file, initFormData, { immediate: true })

watch(visible, (newVal) => {
  if (newVal) {
    nextTick(() => {
      // 聚焦到输入框并选中文件名（不包括扩展名）
      const input = formRef.value?.$el.querySelector('input')
      if (input && props.file) {
        input.focus()
        const filename = props.file.originalName
        const lastDotIndex = filename.lastIndexOf('.')
        if (lastDotIndex > 0) {
          input.setSelectionRange(0, lastDotIndex)
        } else {
          input.select()
        }
      }
    })
  }
})
</script>

<style scoped>
.rename-form {
  padding: 8px 0;
}

.current-name {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  padding: 12px;
  background-color: var(--el-bg-color-page);
  border-radius: 6px;
}

.current-name label {
  font-weight: 500;
  color: var(--el-text-color-regular);
  margin-right: 8px;
}

.current-name span {
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.tips {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 16px;
  padding: 12px;
  background-color: var(--el-color-info-light-9);
  border-radius: 6px;
  font-size: 13px;
  color: var(--el-color-info);
}

.tips .el-icon {
  margin-top: 1px;
  flex-shrink: 0;
}

.dialog-footer {
  text-align: right;
}
</style>
