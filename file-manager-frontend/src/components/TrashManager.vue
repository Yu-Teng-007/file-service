<template>
  <div class="trash-manager">
    <el-dialog
      v-model="visible"
      :title="$t('trash.title')"
      width="80%"
      :before-close="handleClose"
      destroy-on-close
    >
      <div class="trash-container">
        <!-- 工具栏 -->
        <div class="toolbar">
          <div class="toolbar-left">
            <el-input
              v-model="searchQuery"
              :placeholder="$t('trash.searchPlaceholder')"
              :prefix-icon="Search"
              clearable
              style="width: 300px"
              @input="handleSearch"
            />
          </div>
          <div class="toolbar-right">
            <el-button
              type="danger"
              :icon="Delete"
              :disabled="!hasTrashItems"
              @click="handleEmptyTrash"
            >
              {{ $t('trash.emptyTrash') }}
            </el-button>
            <el-button :icon="Refresh" :loading="loading" @click="loadTrashItems">
              {{ $t('common.refresh') }}
            </el-button>
          </div>
        </div>

        <!-- 文件列表 -->
        <div class="file-list">
          <el-table
            ref="tableRef"
            :data="filteredTrashItems"
            :loading="loading"
            @selection-change="handleSelectionChange"
            empty-text="回收站为空"
            height="400"
          >
            <el-table-column type="selection" width="55" />

            <el-table-column :label="$t('file.name')" min-width="200">
              <template #default="{ row }">
                <div class="file-name">
                  <el-icon class="file-icon">
                    <component :is="getFileIcon(row.originalFileInfo)" />
                  </el-icon>
                  <span class="name-text">{{ row.originalFileInfo.filename }}</span>
                </div>
              </template>
            </el-table-column>

            <el-table-column :label="$t('file.size')" width="100">
              <template #default="{ row }">
                {{ formatFileSize(row.originalFileInfo.size) }}
              </template>
            </el-table-column>

            <el-table-column :label="$t('file.category')" width="120">
              <template #default="{ row }">
                <el-tag :type="getCategoryType(row.originalFileInfo.category)">
                  {{ $t(`category.${row.originalFileInfo.category}`) }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column :label="$t('trash.deletedAt')" width="180">
              <template #default="{ row }">
                {{ formatDate(row.deletedAt) }}
              </template>
            </el-table-column>

            <el-table-column :label="$t('trash.deletedBy')" width="120">
              <template #default="{ row }">
                {{ row.deletedBy || $t('common.unknown') }}
              </template>
            </el-table-column>

            <el-table-column :label="$t('trash.originalPath')" min-width="200">
              <template #default="{ row }">
                <span class="original-path">{{ row.originalPath }}</span>
              </template>
            </el-table-column>

            <el-table-column :label="$t('common.actions')" width="150" fixed="right">
              <template #default="{ row }">
                <el-button
                  type="primary"
                  size="small"
                  :icon="RefreshLeft"
                  @click="handleRestore([row.id])"
                >
                  {{ $t('trash.restore') }}
                </el-button>
                <el-button
                  type="danger"
                  size="small"
                  :icon="Delete"
                  @click="handlePermanentDelete([row.id])"
                >
                  {{ $t('trash.permanentDelete') }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 批量操作栏 -->
        <div v-if="selectedItems.length > 0" class="batch-actions">
          <div class="selection-info">
            {{ $t('trash.selectedCount', { count: selectedItems.length }) }}
          </div>
          <div class="actions">
            <el-button type="primary" :icon="RefreshLeft" @click="handleBatchRestore">
              {{ $t('trash.batchRestore') }}
            </el-button>
            <el-button type="danger" :icon="Delete" @click="handleBatchPermanentDelete">
              {{ $t('trash.batchPermanentDelete') }}
            </el-button>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="handleClose">
          {{ $t('common.close') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search,
  Delete,
  Refresh,
  RefreshLeft,
  Document,
  Picture,
  VideoPlay,
  Headset,
  FolderOpened,
} from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import FilesApi from '@/api/files'
import type { TrashItem, FileCategory } from '@/types/file'

// Props and Emits
interface Props {
  modelValue: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'files-restored', count: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Composables
const { t } = useI18n()

// Computed
const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const hasTrashItems = computed(() => trashItems.value.length > 0)

const filteredTrashItems = computed(() => {
  if (!searchQuery.value) return trashItems.value

  const query = searchQuery.value.toLowerCase()
  return trashItems.value.filter(
    item =>
      item.originalFileInfo.filename.toLowerCase().includes(query) ||
      item.originalPath.toLowerCase().includes(query)
  )
})

// Refs
const tableRef = ref()

// State
const loading = ref(false)
const trashItems = ref<TrashItem[]>([])
const selectedItems = ref<TrashItem[]>([])
const searchQuery = ref('')

// Methods
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (dateString: string): string => {
  return dayjs(dateString).format('YYYY-MM-DD HH:mm:ss')
}

const getFileIcon = (fileInfo: any) => {
  const category = fileInfo.category as FileCategory
  const iconMap = {
    images: Picture,
    videos: VideoPlay,
    music: Headset,
    documents: Document,
    archives: FolderOpened,
  }
  return iconMap[category] || Document
}

const getCategoryType = (category: FileCategory): string => {
  const typeMap = {
    images: 'success',
    videos: 'warning',
    music: 'info',
    documents: 'primary',
    archives: 'danger',
  }
  return typeMap[category] || 'default'
}

const loadTrashItems = async () => {
  try {
    loading.value = true
    trashItems.value = await FilesApi.getTrashFiles()
  } catch (error) {
    console.error('Failed to load trash items:', error)
    ElMessage.error(t('trash.loadError'))
  } finally {
    loading.value = false
  }
}

const handleSelectionChange = (selection: TrashItem[]) => {
  selectedItems.value = selection
}

const handleSearch = () => {
  // Search is handled by computed property
}

const handleRestore = async (itemIds: string[]) => {
  try {
    await ElMessageBox.confirm(
      t('trash.restoreConfirm', { count: itemIds.length }),
      t('trash.restoreTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'info',
      }
    )

    await FilesApi.restoreFromTrash(itemIds)
    await loadTrashItems()

    ElMessage.success(t('trash.restoreSuccess', { count: itemIds.length }))
    emit('files-restored', itemIds.length)
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to restore files:', error)
      ElMessage.error(t('trash.restoreError'))
    }
  }
}

const handlePermanentDelete = async (itemIds: string[]) => {
  try {
    await ElMessageBox.confirm(
      t('trash.permanentDeleteConfirm', { count: itemIds.length }),
      t('trash.permanentDeleteTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    )

    await FilesApi.permanentDeleteFiles(itemIds)
    await loadTrashItems()

    ElMessage.success(t('trash.permanentDeleteSuccess', { count: itemIds.length }))
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to permanently delete files:', error)
      ElMessage.error(t('trash.permanentDeleteError'))
    }
  }
}

const handleBatchRestore = () => {
  const itemIds = selectedItems.value.map(item => item.id)
  handleRestore(itemIds)
}

const handleBatchPermanentDelete = () => {
  const itemIds = selectedItems.value.map(item => item.id)
  handlePermanentDelete(itemIds)
}

const handleEmptyTrash = async () => {
  try {
    await ElMessageBox.confirm(t('trash.emptyTrashConfirm'), t('trash.emptyTrashTitle'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
    })

    await FilesApi.emptyTrash()
    await loadTrashItems()

    ElMessage.success(t('trash.emptyTrashSuccess'))
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to empty trash:', error)
      ElMessage.error(t('trash.emptyTrashError'))
    }
  }
}

const handleClose = () => {
  visible.value = false
  selectedItems.value = []
  searchQuery.value = ''
}

// Lifecycle
onMounted(() => {
  if (visible.value) {
    loadTrashItems()
  }
})

// Watch for dialog visibility
watch(visible, newVisible => {
  if (newVisible) {
    loadTrashItems()
  }
})
</script>

<style scoped>
.trash-manager {
  .trash-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background-color: var(--el-fill-color-lighter);
    border-radius: 8px;
  }

  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .file-list {
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    overflow: hidden;
  }

  .file-name {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .file-icon {
    color: var(--el-color-primary);
  }

  .name-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .original-path {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    font-family: monospace;
  }

  .batch-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background-color: var(--el-color-primary-light-9);
    border: 1px solid var(--el-color-primary-light-7);
    border-radius: 8px;
  }

  .selection-info {
    font-size: 14px;
    color: var(--el-color-primary);
    font-weight: 500;
  }

  .actions {
    display: flex;
    gap: 8px;
  }
}

:deep(.el-dialog__body) {
  padding: 20px;
}

:deep(.el-table .el-table__empty-text) {
  color: var(--el-text-color-secondary);
}
</style>
