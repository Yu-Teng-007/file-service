<template>
  <div class="folder-tree">
    <div class="tree-header">
      <h3>{{ $t('folder.title') }}</h3>
      <el-button type="primary" size="small" :icon="Plus" @click="showCreateDialog = true">
        {{ $t('folder.create') }}
      </el-button>
    </div>

    <div class="tree-content">
      <el-tree
        ref="treeRef"
        :data="foldersStore.folderTree"
        :props="treeProps"
        :expand-on-click-node="false"
        :default-expand-all="false"
        node-key="id"
        highlight-current
        @node-click="handleNodeClick"
        @node-contextmenu="handleContextMenu"
      >
        <template #default="{ node, data }">
          <div class="tree-node">
            <el-icon class="node-icon">
              <Folder v-if="!node.expanded" />
              <FolderOpened v-else />
            </el-icon>
            <span class="node-label">{{ data.name }}</span>
            <span class="node-count">({{ data.fileCount }})</span>
          </div>
        </template>
      </el-tree>
    </div>

    <!-- 创建文件夹对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="$t('folder.createDialog.title')"
      width="480px"
      class="create-folder-dialog"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      destroy-on-close
    >
      <div class="dialog-content">
        <div class="dialog-icon">
          <el-icon size="48" color="#409EFF">
            <FolderAdd />
          </el-icon>
        </div>

        <el-form
          ref="createFormRef"
          :model="createForm"
          :rules="createRules"
          label-width="100px"
          class="create-form"
        >
          <el-form-item :label="$t('folder.name')" prop="name">
            <el-input
              v-model="createForm.name"
              :placeholder="$t('folder.createDialog.namePlaceholder')"
              maxlength="50"
              show-word-limit
              size="large"
              clearable
              @keyup.enter="handleCreate"
            >
              <template #prefix>
                <el-icon><Folder /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item :label="$t('folder.parent')" prop="parentId">
            <el-tree-select
              v-model="createForm.parentId"
              :data="foldersStore.folderTree"
              :props="treeProps"
              :placeholder="$t('folder.createDialog.parentPlaceholder')"
              clearable
              check-strictly
              size="large"
              style="width: 100%"
            >
              <template #default="{ node, data }">
                <div class="tree-select-node">
                  <el-icon><Folder /></el-icon>
                  <span>{{ data.name }}</span>
                </div>
              </template>
            </el-tree-select>
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button size="large" @click="showCreateDialog = false" :disabled="creating">
            <el-icon><Close /></el-icon>
            {{ $t('common.cancel') }}
          </el-button>
          <el-button type="primary" size="large" :loading="creating" @click="handleCreate">
            <el-icon v-if="!creating"><Check /></el-icon>
            {{ $t('common.confirm') }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 右键菜单 -->
    <el-dropdown
      ref="contextMenuRef"
      :virtual-ref="contextMenuTarget"
      virtual-triggering
      @command="handleContextCommand"
    >
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="create" :icon="Plus">
            {{ $t('folder.create') }}
          </el-dropdown-item>
          <el-dropdown-item command="rename" :icon="Edit">
            {{ $t('folder.rename') }}
          </el-dropdown-item>
          <el-dropdown-item command="delete" :icon="Delete" divided>
            {{ $t('folder.delete') }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <!-- 重命名对话框 -->
    <el-dialog v-model="showRenameDialog" :title="$t('folder.renameDialog.title')" width="400px">
      <el-form ref="renameFormRef" :model="renameForm" :rules="renameRules" label-width="80px">
        <el-form-item :label="$t('folder.name')" prop="name">
          <el-input
            v-model="renameForm.name"
            :placeholder="$t('folder.renameDialog.namePlaceholder')"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRenameDialog = false">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button type="primary" :loading="renaming" @click="handleRename">
          {{ $t('common.confirm') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  Plus,
  Folder,
  FolderOpened,
  FolderAdd,
  Edit,
  Delete,
  Close,
  Check,
} from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { useFoldersStore } from '@/stores/folders'
import FilesApi from '@/api/files'
import type { FolderInfo, FolderCreateDto } from '@/types/file'

// Props and Emits
interface Props {
  selectedFolderId?: string
}

interface Emits {
  (e: 'folder-select', folder: FolderInfo | null): void
  (e: 'folder-created', folder: FolderInfo): void
  (e: 'folder-updated', folder: FolderInfo): void
  (e: 'folder-deleted', folderId: string): void
}

const props = withDefaults(defineProps<Props>(), {
  selectedFolderId: undefined,
})

const emit = defineEmits<Emits>()

// Composables
const { t } = useI18n()
const foldersStore = useFoldersStore()

// Refs
const treeRef = ref<any>()
const createFormRef = ref<FormInstance>()
const renameFormRef = ref<FormInstance>()
const contextMenuRef = ref<any>()
const contextMenuTarget = ref<HTMLElement>()
const creating = ref(false)
const renaming = ref(false)
const showCreateDialog = ref(false)
const showRenameDialog = ref(false)
const selectedNode = ref<any>(null)

// Forms
const createForm = reactive<FolderCreateDto>({
  name: '',
  parentId: undefined,
})

const renameForm = reactive({
  name: '',
})

// Tree props
const treeProps = {
  children: 'children',
  label: 'name',
  value: 'id',
}

// Form rules
const createRules: FormRules = {
  name: [
    { required: true, message: t('folder.validation.nameRequired'), trigger: 'blur' },
    { min: 1, max: 50, message: t('folder.validation.nameLength'), trigger: 'blur' },
    {
      pattern: /^[^<>:"/\\|?*]+$/,
      message: t('folder.validation.nameInvalid'),
      trigger: 'blur',
    },
  ],
}

const renameRules: FormRules = {
  name: [
    { required: true, message: t('folder.validation.nameRequired'), trigger: 'blur' },
    { min: 1, max: 50, message: t('folder.validation.nameLength'), trigger: 'blur' },
    {
      pattern: /^[^<>:"/\\|?*]+$/,
      message: t('folder.validation.nameInvalid'),
      trigger: 'blur',
    },
  ],
}

// Methods
const loadFolders = async () => {
  try {
    await foldersStore.loadFolders()
  } catch (error) {
    console.error('Failed to load folders:', error)
    ElMessage.error(t('folder.loadError'))
  }
}

const handleNodeClick = (data: FolderInfo) => {
  emit('folder-select', data)
}

const handleContextMenu = (event: MouseEvent, data: FolderInfo, node: any) => {
  event.preventDefault()
  selectedNode.value = { data, node }
  contextMenuTarget.value = event.target as HTMLElement
  contextMenuRef.value?.handleOpen()
}

const handleContextCommand = (command: string) => {
  if (!selectedNode.value) return

  switch (command) {
    case 'create':
      createForm.parentId = selectedNode.value.data.id
      showCreateDialog.value = true
      break
    case 'rename':
      renameForm.name = selectedNode.value.data.name
      showRenameDialog.value = true
      break
    case 'delete':
      handleDelete()
      break
  }
}

const handleCreate = async () => {
  if (!createFormRef.value) return

  try {
    await createFormRef.value.validate()
    creating.value = true

    const folder = await FilesApi.createFolder(createForm)
    await loadFolders()

    showCreateDialog.value = false
    createForm.name = ''
    createForm.parentId = undefined

    ElMessage.success(t('folder.createSuccess'))
    emit('folder-created', folder)
  } catch (error) {
    console.error('Failed to create folder:', error)
    ElMessage.error(t('folder.createError'))
  } finally {
    creating.value = false
  }
}

const handleRename = async () => {
  if (!renameFormRef.value || !selectedNode.value) return

  try {
    await renameFormRef.value.validate()
    renaming.value = true

    const folder = await FilesApi.renameFolder(selectedNode.value.data.id, renameForm.name)
    await loadFolders()

    showRenameDialog.value = false
    renameForm.name = ''

    ElMessage.success(t('folder.renameSuccess'))
    emit('folder-updated', folder)
  } catch (error) {
    console.error('Failed to rename folder:', error)
    ElMessage.error(t('folder.renameError'))
  } finally {
    renaming.value = false
  }
}

const handleDelete = async () => {
  if (!selectedNode.value) return

  try {
    await ElMessageBox.confirm(
      t('folder.deleteConfirm', { name: selectedNode.value.data.name }),
      t('folder.deleteTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    )

    await FilesApi.deleteFolder(selectedNode.value.data.id)
    await loadFolders()

    ElMessage.success(t('folder.deleteSuccess'))
    emit('folder-deleted', selectedNode.value.data.id)
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete folder:', error)
      ElMessage.error(t('folder.deleteError'))
    }
  }
}

// Lifecycle
onMounted(() => {
  loadFolders()
})

// Expose methods
defineExpose({
  refresh: loadFolders,
})
</script>

<style scoped>
.folder-tree {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tree-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.tree-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.tree-content {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.node-icon {
  color: var(--el-color-primary);
}

.node-label {
  flex: 1;
  font-size: 14px;
}

.node-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

:deep(.el-tree-node__content) {
  height: 32px;
  padding-right: 8px;
}

:deep(.el-tree-node__content:hover) {
  background-color: var(--el-fill-color-light);
}

/* 创建文件夹对话框样式 */
.create-folder-dialog {
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

.dialog-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dialog-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px 0;
}

.create-form {
  .el-form-item {
    margin-bottom: 24px;
  }

  .el-form-item__label {
    font-weight: 500;
    color: var(--el-text-color-regular);
  }

  .el-input {
    :deep(.el-input__wrapper) {
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      transition: all 0.3s;
    }

    :deep(.el-input__wrapper:hover) {
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }

    :deep(.el-input__wrapper.is-focus) {
      box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
    }
  }

  .el-tree-select {
    :deep(.el-select__wrapper) {
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      transition: all 0.3s;
    }

    :deep(.el-select__wrapper:hover) {
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }

    :deep(.el-select__wrapper.is-focus) {
      box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
    }
  }
}

.tree-select-node {
  display: flex;
  align-items: center;
  gap: 8px;

  .el-icon {
    color: var(--el-color-primary);
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;

  .el-button {
    border-radius: 8px;
    padding: 12px 24px;
    font-weight: 500;
    transition: all 0.3s;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    &.el-button--primary {
      background: linear-gradient(135deg, #409eff 0%, #337ecc 100%);
      border: none;

      &:hover {
        background: linear-gradient(135deg, #337ecc 0%, #2b6cb0 100%);
      }
    }

    .el-icon {
      margin-right: 6px;
    }
  }
}
</style>
