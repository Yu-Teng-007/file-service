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
          <el-dropdown-item command="changeCategory" :icon="Collection">更改分类</el-dropdown-item>
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

    <!-- 移动文件对话框 -->
    <el-dialog
      v-model="showMoveDialog"
      title="批量移动文件"
      width="520px"
      class="batch-move-dialog"
      :close-on-click-modal="false"
    >
      <div class="move-dialog-content">
        <!-- 批量操作信息 -->
        <div class="batch-info-card">
          <div class="batch-icon">
            <el-icon size="24"><FolderOpened /></el-icon>
          </div>
          <div class="batch-details">
            <div class="batch-title">批量移动操作</div>
            <div class="batch-meta">
              已选择
              <strong>{{ selectedFiles.length }}</strong>
              个文件
            </div>
          </div>
        </div>

        <!-- 操作说明 -->
        <div class="operation-description">
          <el-icon class="info-icon"><InfoFilled /></el-icon>
          <span>选择文件的目标文件夹</span>
        </div>

        <!-- 文件夹选择 -->
        <el-form :model="moveForm" class="move-form">
          <el-form-item label="目标文件夹">
            <el-tree-select
              v-model="moveForm.folderId"
              :data="foldersStore.folderTree"
              :props="folderTreeProps"
              :placeholder="$t('batch.selectFolder')"
              clearable
              check-strictly
              class="folder-selector"
            />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showMoveDialog = false" size="default">
            {{ $t('common.cancel') }}
          </el-button>
          <el-button type="primary" :loading="processing" @click="handleMoveConfirm" size="default">
            <el-icon v-if="!processing"><FolderOpened /></el-icon>
            确认移动
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 更改分类对话框 -->
    <el-dialog
      v-model="showChangeCategoryDialog"
      title="批量更改分类"
      width="520px"
      class="batch-change-category-dialog"
      :close-on-click-modal="false"
    >
      <div class="change-category-dialog-content">
        <!-- 批量操作信息 -->
        <div class="batch-info-card">
          <div class="batch-icon">
            <el-icon size="24"><Edit /></el-icon>
          </div>
          <div class="batch-details">
            <div class="batch-title">批量更改分类</div>
            <div class="batch-meta">
              已选择
              <strong>{{ selectedFiles.length }}</strong>
              个文件
            </div>
          </div>
        </div>

        <!-- 操作说明 -->
        <div class="operation-description">
          <el-icon class="info-icon"><InfoFilled /></el-icon>
          <span>为选中的文件设置新的分类标记</span>
        </div>

        <!-- 分类选择 -->
        <el-form :model="changeCategoryForm" class="category-form">
          <el-form-item label="选择分类">
            <div class="category-grid">
              <el-radio-group v-model="changeCategoryForm.category" class="category-radio-group">
                <el-radio
                  v-for="category in categories"
                  :key="category.value"
                  :value="category.value"
                  :label="category.value"
                  class="category-radio"
                >
                  <div class="category-option">
                    <el-icon class="category-icon">
                      <component :is="getCategoryIcon(category.value)" />
                    </el-icon>
                    <span class="category-label">{{ category.label }}</span>
                  </div>
                </el-radio>
              </el-radio-group>
            </div>
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showChangeCategoryDialog = false" size="default">
            {{ $t('common.cancel') }}
          </el-button>
          <el-button
            type="primary"
            :loading="processing"
            @click="handleChangeCategoryConfirm"
            size="default"
          >
            <el-icon v-if="!processing"><Edit /></el-icon>
            确认更改
          </el-button>
        </div>
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
  Collection,
  Edit,
  InfoFilled,
  Document,
  Picture,
  VideoPlay,
  Headset,
} from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { useFoldersStore } from '@/stores/folders'
import FilesApi from '@/api/files'
import { FileCategory, FileAccessLevel } from '@/types/file'
import type { FileInfo, FolderInfo, FileTag, BatchOperation } from '@/types/file'

interface Props {
  selectedFiles: FileInfo[]
}

interface Emits {
  (e: 'operation-complete', operation: string, count: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const foldersStore = useFoldersStore()

const hasSelection = computed(() => props.selectedFiles.length > 0)

const processing = ref(false)
const showMoveDialog = ref(false)
const showChangeCategoryDialog = ref(false)
const showTagsDialog = ref(false)
const showAccessDialog = ref(false)

const availableTags = ref<FileTag[]>([])
const selectedTagIds = ref<string[]>([])

const moveForm = reactive({
  folderId: '',
})

const changeCategoryForm = reactive({
  category: '',
})

const accessForm = reactive({
  accessLevel: '',
})

const newTag = reactive({
  name: '',
  color: '#409EFF',
})

const folderTreeProps = {
  children: 'children',
  label: 'name',
  value: 'id',
}

const categories = computed(() => [
  { label: t('file.categories.images'), value: FileCategory.IMAGE },
  { label: t('file.categories.documents'), value: FileCategory.DOCUMENT },
  { label: t('file.categories.music'), value: FileCategory.MUSIC },
  { label: t('file.categories.videos'), value: FileCategory.VIDEO },
  { label: t('file.categories.archives'), value: FileCategory.ARCHIVE },
])

const getCategoryIcon = (category: string) => {
  const iconMap: Record<string, any> = {
    images: Picture,
    documents: Document,
    music: Headset,
    videos: VideoPlay,
    archives: FolderOpened,
    scripts: Document,
    styles: Document,
    fonts: Document,
    temp: Document,
  }
  return iconMap[category] || Document
}

const accessLevels = computed(() => [
  { label: t('file.accessLevels.public'), value: 'public' },
  { label: t('file.accessLevels.private'), value: 'private' },
  { label: t('file.accessLevels.protected'), value: 'protected' },
])

// 初始化批量移动表单
const initializeBatchMoveForm = () => {
  // 对于批量操作，我们需要找到共同的文件夹
  const folders = new Set(props.selectedFiles.map(file => file.folderId || 'all'))

  // 如果所有文件都在同一个文件夹，设置为默认值
  if (folders.size === 1) {
    moveForm.folderId = Array.from(folders)[0]
  } else {
    // 如果文件在不同文件夹，默认选择 'all'
    moveForm.folderId = 'all'
  }
}

// 初始化批量更改分类表单
const initializeBatchChangeCategoryForm = () => {
  // 对于批量操作，我们需要找到共同的分类
  const categories = new Set(props.selectedFiles.map(file => file.category))

  // 如果所有文件都是同一个分类，设置为默认值
  if (categories.size === 1) {
    changeCategoryForm.category = Array.from(categories)[0]
  } else {
    // 如果文件有不同分类，不设置默认值
    changeCategoryForm.category = ''
  }
}

const handleCommand = (command: string) => {
  switch (command) {
    case 'download':
      handleBatchDownload()
      break
    case 'move':
      initializeBatchMoveForm()
      showMoveDialog.value = true
      break
    case 'changeCategory':
      initializeBatchChangeCategoryForm()
      showChangeCategoryDialog.value = true
      break
    case 'copy':
      ElMessage.info('复制功能暂未实现')
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

    const targetFolderId = moveForm.folderId

    // 检查是否有任何更改
    const filesToMove = props.selectedFiles.filter(
      file => targetFolderId && targetFolderId !== (file.folderId || 'all')
    )

    if (filesToMove.length === 0) {
      ElMessage.info('没有文件需要移动')
      showMoveDialog.value = false
      return
    }

    // 执行文件夹移动操作
    await FilesApi.moveFilesToFolder(
      filesToMove.map(f => f.id),
      targetFolderId
    )

    showMoveDialog.value = false
    moveForm.folderId = ''

    emit('operation-complete', 'move', filesToMove.length)
  } catch (error) {
    console.error('Failed to move files:', error)
    ElMessage.error('移动失败')
  } finally {
    processing.value = false
  }
}

const handleChangeCategoryConfirm = async () => {
  try {
    processing.value = true

    const targetCategory = changeCategoryForm.category

    if (!targetCategory) {
      ElMessage.error('请选择分类')
      return
    }

    // 检查是否有任何更改
    const filesToUpdate = props.selectedFiles.filter(file => targetCategory !== file.category)

    if (filesToUpdate.length === 0) {
      ElMessage.info('没有文件需要更改分类')
      showChangeCategoryDialog.value = false
      return
    }

    // 执行分类标记更新操作
    for (const file of filesToUpdate) {
      const updates = {
        category: targetCategory as FileCategory,
      }
      await FilesApi.updateFile(file.id, updates)
    }

    showChangeCategoryDialog.value = false
    changeCategoryForm.category = ''

    emit('operation-complete', 'changeCategory', filesToUpdate.length)
  } catch (error) {
    console.error('Failed to change category:', error)
    ElMessage.error('更改分类失败')
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
      action: 'move',
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

onMounted(() => {
  loadFolders()
  loadTags()
})
</script>

<style lang="scss" scoped>
.batch-operations {
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

/* 批量移动对话框样式 */
.batch-move-dialog {
  :deep(.el-dialog) {
    border-radius: 12px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
  }

  :deep(.el-dialog__header) {
    padding: 24px 24px 16px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  :deep(.el-dialog__title) {
    font-size: 18px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  :deep(.el-dialog__body) {
    padding: 24px;
  }

  :deep(.el-dialog__footer) {
    padding: 16px 24px 24px;
    border-top: 1px solid var(--el-border-color-lighter);
  }
}

/* 批量更改分类对话框样式 */
.batch-change-category-dialog {
  :deep(.el-dialog) {
    border-radius: 12px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
  }

  :deep(.el-dialog__header) {
    padding: 24px 24px 16px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  :deep(.el-dialog__title) {
    font-size: 18px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  :deep(.el-dialog__body) {
    padding: 24px;
    max-height: 60vh;
    overflow-y: auto;
  }

  :deep(.el-dialog__footer) {
    padding: 16px 24px 24px;
    border-top: 1px solid var(--el-border-color-lighter);
  }
}

.move-dialog-content,
.change-category-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: 20px;
}

.batch-info-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(
    135deg,
    var(--el-color-success-light-9) 0%,
    var(--el-color-success-light-8) 100%
  );
  border-radius: 8px;
  border: 1px solid var(--el-color-success-light-7);

  .batch-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: var(--el-color-success-light-8);
    border-radius: 8px;
    color: var(--el-color-success);
  }

  .batch-details {
    flex: 1;
    min-width: 0;

    .batch-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      margin-bottom: 4px;
    }

    .batch-meta {
      font-size: 13px;
      color: var(--el-text-color-secondary);

      strong {
        color: var(--el-color-success);
        font-weight: 600;
      }
    }
  }
}

.operation-description {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--el-color-info-light-9);
  border-radius: 6px;
  font-size: 14px;
  color: var(--el-color-info-dark-2);

  .info-icon {
    color: var(--el-color-info);
    flex-shrink: 0;
  }
}

.move-form,
.category-form {
  .el-form-item {
    margin-bottom: 0;
  }

  .el-form-item__label {
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .folder-selector {
    width: 100%;
  }
}

.category-form {
  .el-form-item__label {
    margin-bottom: 12px;
  }
}

.category-grid {
  width: 100%;
}

.category-radio-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;

  :deep(.el-radio) {
    margin: 0;
    width: 100%;

    .el-radio__input {
      display: none;
    }

    .el-radio__label {
      padding: 0;
      width: 100%;
    }

    .category-option {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      gap: 12px;
      padding: 12px 16px;
      border: 2px solid var(--el-border-color-light);
      border-radius: 8px;
      background: var(--el-bg-color);
      cursor: pointer;
      transition: all 0.3s ease;
      min-height: 50px;
      width: 100%;

      &:hover {
        border-color: var(--el-color-primary-light-5);
        background: var(--el-color-primary-light-9);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      .category-icon {
        font-size: 20px;
        color: var(--el-text-color-secondary);
        transition: color 0.3s ease;
        line-height: 1;
        flex-shrink: 0;
      }

      .category-label {
        font-size: 14px;
        font-weight: 500;
        color: var(--el-text-color-regular);
        text-align: left;
        transition: color 0.3s ease;
        line-height: 1.2;
        margin: 0;
        flex: 1;
      }
    }

    /* 选中状态样式 */
    &.is-checked .category-option {
      border-color: var(--el-color-primary);
      background: var(--el-color-primary-light-9);
      box-shadow: 0 0 0 1px var(--el-color-primary-light-7);

      .category-icon {
        color: var(--el-color-primary);
      }

      .category-label {
        color: var(--el-color-primary);
        font-weight: 600;
      }
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
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
