<template>
  <div class="folder-tree">
    <div class="tree-header">
      <h3>{{ $t('folder.title') }}</h3>
      <div class="header-actions">
        <el-button
          size="small"
          :icon="Refresh"
          @click="handleRefresh"
          :loading="foldersStore.loading"
          title="刷新文件夹列表"
        >
          {{ $t('common.refresh') }}
        </el-button>
        <el-button type="primary" size="small" :icon="Plus" @click="showCreateDialog = true">
          {{ $t('folder.create') }}
        </el-button>
      </div>
    </div>

    <div class="tree-content">
      <el-tree
        ref="treeRef"
        :data="foldersStore.folderTree"
        :props="treeProps"
        :expand-on-click-node="false"
        :default-expand-all="false"
        :expanded-keys="expandedKeys"
        :current-node-key="currentSelectedKey"
        node-key="id"
        highlight-current
        @node-click="handleNodeClick"
        @node-contextmenu="handleContextMenu"
        @node-expand="handleNodeExpand"
        @node-collapse="handleNodeCollapse"
      >
        <template #default="{ node, data }">
          <div class="tree-node" :class="{ 'system-folder': data.isSystem }">
            <el-icon class="node-icon">
              <!-- 【全部】文件夹使用特殊图标 -->
              <template v-if="data.isSystem">
                <svg viewBox="0 0 1024 1024" width="1em" height="1em">
                  <path
                    fill="currentColor"
                    d="M128 384v448h768V384H128zm-32-64h832a32 32 0 0 1 32 32v512a32 32 0 0 1-32 32H96a32 32 0 0 1-32-32V352a32 32 0 0 1 32-32z"
                  />
                  <path
                    fill="currentColor"
                    d="M384 128v192h256V128H384zm-32-64h320a32 32 0 0 1 32 32v256a32 32 0 0 1-32 32H352a32 32 0 0 1-32-32V96a32 32 0 0 1 32-32z"
                  />
                </svg>
              </template>
              <template v-else>
                <Folder v-if="!node.expanded" />
                <FolderOpened v-else />
              </template>
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
    <transition name="context-menu-fade">
      <div
        ref="contextMenuRef"
        class="context-menu"
        :style="contextMenuStyle"
        v-show="showContextMenu"
        @click.stop
      >
        <el-card class="context-menu-card" shadow="always">
          <!-- "全部"文件夹不显示创建选项，其他文件夹显示 -->
          <template v-if="!(selectedNode?.data?.isSystem && selectedNode?.data?.id === 'all')">
            <div class="menu-item" @click="handleContextCommand('create')">
              <el-icon><Plus /></el-icon>
              <span>{{ $t('folder.create') }}</span>
            </div>
          </template>
          <!-- 系统文件夹不能重命名和删除 -->
          <template v-if="!selectedNode?.data?.isSystem">
            <el-divider
              v-if="!(selectedNode?.data?.isSystem && selectedNode?.data?.id === 'all')"
            />
            <div class="menu-item" @click="handleContextCommand('rename')">
              <el-icon><Edit /></el-icon>
              <span>{{ $t('folder.rename') }}</span>
            </div>
            <el-divider />
            <div class="menu-item danger" @click="handleContextCommand('delete')">
              <el-icon><Delete /></el-icon>
              <span>{{ $t('folder.delete') }}</span>
            </div>
          </template>
          <!-- 如果是"全部"文件夹且没有其他选项，显示提示 -->
          <template v-if="selectedNode?.data?.isSystem && selectedNode?.data?.id === 'all'">
            <div class="menu-item disabled">
              <el-icon><InfoFilled /></el-icon>
              <span>系统文件夹无可用操作</span>
            </div>
          </template>
        </el-card>
      </div>
    </transition>

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
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
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
  InfoFilled,
  Refresh,
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
const creating = ref(false)
const renaming = ref(false)
const showCreateDialog = ref(false)
const showRenameDialog = ref(false)
const showContextMenu = ref(false)
const selectedNode = ref<any>(null)
const contextMenuStyle = ref<any>({})

// 状态管理：保存展开的节点和当前选中的节点
const expandedKeys = ref<string[]>([])
const currentSelectedKey = ref<string>('all')

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

// Helper functions
const findFolderInTree = (folders: FolderInfo[], targetId: string): FolderInfo | null => {
  for (const folder of folders) {
    if (folder.id === targetId) {
      return folder
    }
    if (folder.children && folder.children.length > 0) {
      const found = findFolderInTree(folder.children, targetId)
      if (found) return found
    }
  }
  return null
}

const expandParentFolders = (folderId: string, allFolders: FolderInfo[]) => {
  // 找到目标文件夹
  const targetFolder = allFolders.find(f => f.id === folderId)
  if (!targetFolder || !targetFolder.parentId) return

  // 递归展开所有父级文件夹
  const expandParent = (parentId: string) => {
    if (!expandedKeys.value.includes(parentId)) {
      expandedKeys.value.push(parentId)
    }

    const parentFolder = allFolders.find(f => f.id === parentId)
    if (parentFolder && parentFolder.parentId) {
      expandParent(parentFolder.parentId)
    }
  }

  expandParent(targetFolder.parentId)
}

const selectAndExpandToFolder = async (folderId: string) => {
  // 等待DOM更新
  await nextTick()

  // 展开所有父级文件夹
  expandParentFolders(folderId, foldersStore.folders)

  // 选中目标文件夹
  if (treeRef.value) {
    currentSelectedKey.value = folderId
    treeRef.value.setCurrentKey(folderId)

    // 触发选择事件
    const folderData =
      foldersStore.folderTree.find(f => f.id === folderId) ||
      findFolderInTree(foldersStore.folderTree, folderId)
    if (folderData) {
      emit('folder-select', folderData)
    }
  }
}

// Methods
const loadFolders = async (force = false) => {
  try {
    await foldersStore.loadFolders(force)
  } catch (error) {
    console.error('Failed to load folders:', error)
    ElMessage.error(t('folder.loadError'))
  }
}

const handleNodeClick = (data: FolderInfo) => {
  currentSelectedKey.value = data.id
  emit('folder-select', data)
}

const handleNodeExpand = (data: FolderInfo) => {
  if (!expandedKeys.value.includes(data.id)) {
    expandedKeys.value.push(data.id)
  }
}

const handleNodeCollapse = (data: FolderInfo) => {
  const index = expandedKeys.value.indexOf(data.id)
  if (index > -1) {
    expandedKeys.value.splice(index, 1)
  }
}

const handleContextMenu = (event: MouseEvent, data: FolderInfo, node: any) => {
  event.preventDefault()
  selectedNode.value = { data, node }

  // 设置菜单位置
  contextMenuStyle.value = {
    position: 'fixed',
    left: `${event.clientX}px`,
    top: `${event.clientY}px`,
    zIndex: 9999,
  }

  // 显示菜单
  showContextMenu.value = true

  // 点击其他地方关闭菜单
  const closeMenu = () => {
    showContextMenu.value = false
    document.removeEventListener('click', closeMenu)
  }

  // 延迟添加事件监听器，避免立即触发
  setTimeout(() => {
    document.addEventListener('click', closeMenu)
  }, 0)
}

const handleContextCommand = (command: string) => {
  if (!selectedNode.value) return

  // 关闭右键菜单
  showContextMenu.value = false

  // 系统文件夹不能重命名和删除
  if (selectedNode.value.data.isSystem && (command === 'rename' || command === 'delete')) {
    ElMessage.warning('系统文件夹不能进行此操作')
    return
  }

  // "全部"文件夹不能创建子文件夹
  if (
    selectedNode.value.data.isSystem &&
    selectedNode.value.data.id === 'all' &&
    command === 'create'
  ) {
    ElMessage.warning('不能在"全部"文件夹下创建子文件夹，请在其他文件夹下创建')
    return
  }

  switch (command) {
    case 'create':
      // 如果是系统文件夹，将parentId设为undefined（创建根级文件夹）
      createForm.parentId = selectedNode.value.data.isSystem
        ? undefined
        : selectedNode.value.data.id
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
    await loadFolders(true) // 强制刷新文件夹列表

    showCreateDialog.value = false
    createForm.name = ''
    createForm.parentId = undefined

    // 选中新创建的文件夹并展开到它
    if (folder.id) {
      await selectAndExpandToFolder(folder.id)
    }

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

    const folderId = selectedNode.value.data.id
    const folder = await FilesApi.renameFolder(folderId, renameForm.name)
    await loadFolders(true) // 强制刷新文件夹列表

    showRenameDialog.value = false
    renameForm.name = ''

    // 重新选中重命名后的文件夹
    await selectAndExpandToFolder(folderId)

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

  // 系统文件夹不能删除
  if (selectedNode.value.data.isSystem) {
    ElMessage.warning('系统文件夹不能删除')
    return
  }

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

    // 尝试删除文件夹
    try {
      await FilesApi.deleteFolder(selectedNode.value.data.id)
      await loadFolders(true) // 强制刷新文件夹列表
      ElMessage.success(t('folder.deleteSuccess'))
      emit('folder-deleted', selectedNode.value.data.id)
    } catch (deleteError: any) {
      // 删除失败，错误信息已由API客户端处理，这里不需要额外处理
      console.error('Failed to delete folder:', deleteError)
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete folder:', error)
      // 不显示错误消息，因为API客户端已经显示了
    }
  }
}

// 刷新文件夹列表
const handleRefresh = async () => {
  try {
    await foldersStore.refreshFolders()
    ElMessage.success(t('folder.refreshSuccess'))
  } catch (error) {
    console.error('刷新文件夹列表失败:', error)
    ElMessage.error(t('folder.refreshError'))
  }
}

onMounted(async () => {
  await loadFolders()
  // 默认选择【全部】文件夹
  nextTick(() => {
    const allFolder = foldersStore.folderTree.find(folder => folder.id === 'all')
    if (allFolder && treeRef.value) {
      // 设置树的当前选中节点
      currentSelectedKey.value = 'all'
      treeRef.value.setCurrentKey('all')
      // 触发文件夹选择事件
      emit('folder-select', allFolder)
    }
  })
})

// Expose methods
defineExpose({
  refresh: loadFolders,
})
</script>

<style scoped lang="scss">
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

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
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

  /* 系统文件夹样式 */
  &.system-folder {
    font-weight: 600;

    .node-icon {
      color: var(--el-color-warning);
    }

    .node-label {
      color: var(--el-color-warning-dark-2);
    }
  }
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

/* 右键菜单样式 */
.context-menu {
  position: fixed;
  z-index: 9999;

  .context-menu-card {
    padding: 4px 0;
    border-radius: 6px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
    border: 1px solid var(--el-border-color-lighter);
    min-width: 140px;
    background: var(--el-bg-color-overlay);
    backdrop-filter: blur(8px);

    :deep(.el-card__body) {
      padding: 0;
    }
  }

  .menu-item {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 13px;
    color: var(--el-text-color-primary);
    position: relative;

    &:first-child {
      border-radius: 6px 6px 0 0;
    }

    &:last-child {
      border-radius: 0 0 6px 6px;
    }

    &:hover {
      background-color: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
      transform: translateX(2px);
    }

    &.danger {
      color: var(--el-color-danger);

      &:hover {
        background-color: var(--el-color-danger-light-9);
        color: var(--el-color-danger-dark-2);
      }
    }

    .el-icon {
      margin-right: 6px;
      font-size: 14px;
      width: 14px;
      height: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    span {
      font-weight: 500;
      white-space: nowrap;
    }
  }

  .menu-item.disabled {
    color: var(--el-text-color-disabled);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .menu-item.disabled:hover {
    background-color: transparent;
    color: var(--el-text-color-disabled);
  }

  /* 分割线样式 */
  :deep(.el-divider) {
    margin: 2px 8px;
    border-color: var(--el-border-color-lighter);
  }
}

/* 右键菜单动画 */
.context-menu-fade-enter-active {
  transition: all 0.15s ease-out;
}

.context-menu-fade-leave-active {
  transition: all 0.1s ease-in;
}

.context-menu-fade-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}

.context-menu-fade-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-2px);
}
</style>
