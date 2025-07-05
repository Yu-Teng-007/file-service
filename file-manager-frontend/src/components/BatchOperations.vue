<template>
  <div class="batch-operations">
    <el-dropdown trigger="click" :disabled="!hasSelection" @command="handleCommand">
      <el-button type="primary" :disabled="!hasSelection" :icon="Operation">
        {{ $t('batch.operations') }}
        <el-icon class="el-icon--right"><ArrowDown /></el-icon>
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="download" :icon="Download">
            {{ $t('batch.download') }}
          </el-dropdown-item>
          <el-dropdown-item command="move" :icon="FolderOpened">
            {{ $t('batch.move') }}
          </el-dropdown-item>
          <el-dropdown-item command="copy" :icon="CopyDocument">
            {{ $t('batch.copy') }}
          </el-dropdown-item>
          <el-dropdown-item command="addTags" :icon="PriceTag">
            {{ $t('batch.addTags') }}
          </el-dropdown-item>
          <el-dropdown-item command="changeAccess" :icon="Lock">
            {{ $t('batch.changeAccess') }}
          </el-dropdown-item>
          <el-dropdown-item command="delete" :icon="Delete" divided class="danger-item">
            {{ $t('batch.delete') }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <!-- 移动/复制对话框 -->
    <el-dialog v-model="showMoveDialog" :title="moveDialogTitle" width="500px">
      <div class="move-dialog-content">
        <p>{{ $t('batch.moveDescription', { count: selectedFiles.length }) }}</p>

        <el-form :model="moveForm" label-width="100px">
          <el-form-item :label="$t('batch.targetFolder')">
            <el-tree-select
              v-model="moveForm.folderId"
              :data="foldersStore.folderTree"
              :props="folderTreeProps"
              :placeholder="$t('batch.selectFolder')"
              clearable
              check-strictly
            />
          </el-form-item>

          <el-form-item :label="$t('batch.targetCategory')">
            <el-select
              v-model="moveForm.category"
              :placeholder="$t('batch.selectCategory')"
              clearable
            >
              <el-option
                v-for="category in categories"
                :key="category.value"
                :label="category.label"
                :value="category.value"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="showMoveDialog = false">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button type="primary" :loading="processing" @click="handleMoveConfirm">
          {{ currentOperation === 'move' ? $t('batch.move') : $t('batch.copy') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 标签管理对话框 -->
    <el-dialog v-model="showTagsDialog" :title="$t('batch.manageTags')" width="500px">
      <div class="tags-dialog-content">
        <p>{{ $t('batch.tagsDescription', { count: selectedFiles.length }) }}</p>

        <div class="tag-selection">
          <h4>{{ $t('batch.availableTags') }}</h4>
          <div class="tag-list">
            <el-checkbox-group v-model="selectedTagIds">
              <el-checkbox
                v-for="tag in availableTags"
                :key="tag.id"
                :label="tag.id"
                :value="tag.id"
              >
                <el-tag :color="tag.color" size="small">{{ tag.name }}</el-tag>
              </el-checkbox>
            </el-checkbox-group>
          </div>
        </div>

        <div class="create-tag">
          <h4>{{ $t('batch.createNewTag') }}</h4>
          <el-form :model="newTag" inline>
            <el-form-item>
              <el-input
                v-model="newTag.name"
                :placeholder="$t('batch.tagName')"
                style="width: 150px"
              />
            </el-form-item>
            <el-form-item>
              <el-color-picker v-model="newTag.color" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" size="small" @click="createTag">
                {{ $t('batch.create') }}
              </el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>

      <template #footer>
        <el-button @click="showTagsDialog = false">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button type="primary" :loading="processing" @click="handleTagsConfirm">
          {{ $t('batch.applyTags') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 访问级别对话框 -->
    <el-dialog v-model="showAccessDialog" :title="$t('batch.changeAccessLevel')" width="400px">
      <div class="access-dialog-content">
        <p>{{ $t('batch.accessDescription', { count: selectedFiles.length }) }}</p>

        <el-form :model="accessForm" label-width="100px">
          <el-form-item :label="$t('batch.accessLevel')">
            <el-select v-model="accessForm.accessLevel" style="width: 100%">
              <el-option
                v-for="level in accessLevels"
                :key="level.value"
                :label="level.label"
                :value="level.value"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="showAccessDialog = false">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button type="primary" :loading="processing" @click="handleAccessConfirm">
          {{ $t('batch.apply') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Operation,
  ArrowDown,
  Download,
  FolderOpened,
  CopyDocument,
  PriceTag,
  Lock,
  Delete,
} from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { useFoldersStore } from '@/stores/folders'
import FilesApi from '@/api/files'
import type {
  FileInfo,
  FolderInfo,
  FileTag,
  FileCategory,
  FileAccessLevel,
  BatchOperation,
} from '@/types/file'

// Props and Emits
interface Props {
  selectedFiles: FileInfo[]
}

interface Emits {
  (e: 'operation-complete', operation: string, count: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Composables
const { t } = useI18n()
const foldersStore = useFoldersStore()

// Computed
const hasSelection = computed(() => props.selectedFiles.length > 0)

const moveDialogTitle = computed(() => {
  return currentOperation.value === 'move' ? t('batch.moveFiles') : t('batch.copyFiles')
})

// State
const processing = ref(false)
const showMoveDialog = ref(false)
const showTagsDialog = ref(false)
const showAccessDialog = ref(false)
const currentOperation = ref<'move' | 'copy'>('move')

const availableTags = ref<FileTag[]>([])
const selectedTagIds = ref<string[]>([])

// Forms
const moveForm = reactive({
  folderId: '',
  category: '',
})

const accessForm = reactive({
  accessLevel: '',
})

const newTag = reactive({
  name: '',
  color: '#409EFF',
})

// Constants
const folderTreeProps = {
  children: 'children',
  label: 'name',
  value: 'id',
}

const categories = [
  { label: t('category.images'), value: 'images' },
  { label: t('category.videos'), value: 'videos' },
  { label: t('category.music'), value: 'music' },
  { label: t('category.documents'), value: 'documents' },
  { label: t('category.archives'), value: 'archives' },
  { label: t('category.scripts'), value: 'scripts' },
  { label: t('category.styles'), value: 'styles' },
  { label: t('category.fonts'), value: 'fonts' },
]

const accessLevels = [
  { label: t('access.public'), value: 'public' },
  { label: t('access.private'), value: 'private' },
  { label: t('access.protected'), value: 'protected' },
]

// Methods
const handleCommand = (command: string) => {
  switch (command) {
    case 'download':
      handleBatchDownload()
      break
    case 'move':
      currentOperation.value = 'move'
      showMoveDialog.value = true
      break
    case 'copy':
      currentOperation.value = 'copy'
      showMoveDialog.value = true
      break
    case 'addTags':
      showTagsDialog.value = true
      break
    case 'changeAccess':
      showAccessDialog.value = true
      break
    case 'delete':
      handleBatchDelete()
      break
  }
}

const handleBatchDownload = async () => {
  try {
    // Create a zip file with selected files
    const fileIds = props.selectedFiles.map(file => file.id)

    // This would need to be implemented in the backend
    // For now, download files individually
    for (const file of props.selectedFiles) {
      await FilesApi.downloadFile(file.id, file.filename)
    }

    ElMessage.success(t('batch.downloadSuccess', { count: props.selectedFiles.length }))
    emit('operation-complete', 'download', props.selectedFiles.length)
  } catch (error) {
    console.error('Failed to download files:', error)
    ElMessage.error(t('batch.downloadError'))
  }
}

const handleMoveConfirm = async () => {
  try {
    processing.value = true

    const operation: BatchOperation = {
      action: currentOperation.value,
      fileIds: props.selectedFiles.map(file => file.id),
      targetCategory: moveForm.category as FileCategory,
    }

    if (moveForm.folderId) {
      await FilesApi.moveFilesToFolder(operation.fileIds, moveForm.folderId)
    } else {
      await FilesApi.batchOperation(operation)
    }

    showMoveDialog.value = false
    moveForm.folderId = ''
    moveForm.category = ''

    ElMessage.success(
      t(`batch.${currentOperation.value}Success`, { count: props.selectedFiles.length })
    )
    emit('operation-complete', currentOperation.value, props.selectedFiles.length)
  } catch (error) {
    console.error(`Failed to ${currentOperation.value} files:`, error)
    ElMessage.error(t(`batch.${currentOperation.value}Error`))
  } finally {
    processing.value = false
  }
}

const handleTagsConfirm = async () => {
  try {
    processing.value = true

    for (const file of props.selectedFiles) {
      await FilesApi.addTagsToFile(file.id, selectedTagIds.value)
    }

    showTagsDialog.value = false
    selectedTagIds.value = []

    ElMessage.success(t('batch.tagsSuccess', { count: props.selectedFiles.length }))
    emit('operation-complete', 'addTags', props.selectedFiles.length)
  } catch (error) {
    console.error('Failed to add tags:', error)
    ElMessage.error(t('batch.tagsError'))
  } finally {
    processing.value = false
  }
}

const handleAccessConfirm = async () => {
  try {
    processing.value = true

    const operation: BatchOperation = {
      action: 'move', // Using move action to update access level
      fileIds: props.selectedFiles.map(file => file.id),
      targetAccessLevel: accessForm.accessLevel as FileAccessLevel,
    }

    await FilesApi.batchOperation(operation)

    showAccessDialog.value = false
    accessForm.accessLevel = ''

    ElMessage.success(t('batch.accessSuccess', { count: props.selectedFiles.length }))
    emit('operation-complete', 'changeAccess', props.selectedFiles.length)
  } catch (error) {
    console.error('Failed to change access level:', error)
    ElMessage.error(t('batch.accessError'))
  } finally {
    processing.value = false
  }
}

const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(
      t('batch.deleteConfirm', { count: props.selectedFiles.length }),
      t('batch.deleteTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    )

    const operation: BatchOperation = {
      action: 'delete',
      fileIds: props.selectedFiles.map(file => file.id),
    }

    await FilesApi.batchOperation(operation)

    ElMessage.success(t('batch.deleteSuccess', { count: props.selectedFiles.length }))
    emit('operation-complete', 'delete', props.selectedFiles.length)
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete files:', error)
      ElMessage.error(t('batch.deleteError'))
    }
  }
}

const createTag = async () => {
  if (!newTag.name.trim()) {
    ElMessage.warning(t('batch.tagNameRequired'))
    return
  }

  try {
    const tag = await FilesApi.createTag({
      name: newTag.name,
      color: newTag.color,
    })

    availableTags.value.push(tag)
    newTag.name = ''
    newTag.color = '#409EFF'

    ElMessage.success(t('batch.tagCreated'))
  } catch (error) {
    console.error('Failed to create tag:', error)
    ElMessage.error(t('batch.tagCreateError'))
  }
}

const loadFolders = async () => {
  try {
    await foldersStore.loadFolders()
  } catch (error) {
    console.error('Failed to load folders:', error)
  }
}

const loadTags = async () => {
  try {
    availableTags.value = await FilesApi.getTags()
  } catch (error) {
    console.error('Failed to load tags:', error)
  }
}

// Lifecycle
onMounted(() => {
  loadFolders()
  loadTags()
})
</script>

<style scoped>
.batch-operations {
  .move-dialog-content,
  .tags-dialog-content,
  .access-dialog-content {
    padding: 16px 0;
  }

  .tag-selection {
    margin-bottom: 24px;
  }

  .tag-selection h4,
  .create-tag h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-regular);
  }

  .tag-list {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid var(--el-border-color-light);
    border-radius: 4px;
    padding: 12px;
  }

  .create-tag {
    border-top: 1px solid var(--el-border-color-light);
    padding-top: 16px;
  }
}

:deep(.el-checkbox) {
  display: block;
  margin-bottom: 8px;
}

:deep(.el-checkbox__label) {
  padding-left: 8px;
}

/* 危险操作样式 */
:deep(.danger-item) {
  color: var(--el-color-danger) !important;

  &:hover {
    background-color: var(--el-color-danger-light-9) !important;
    color: var(--el-color-danger-dark-2) !important;
  }

  .el-icon {
    color: var(--el-color-danger) !important;
  }
}
</style>
