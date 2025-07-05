<template>
  <div class="file-list-page">
    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 左侧文件夹树 -->
      <div class="sidebar">
        <FolderTree
          :selected-folder-id="currentFolderId"
          @folder-select="handleFolderSelect"
          @folder-created="handleFolderCreated"
          @folder-updated="handleFolderUpdated"
          @folder-deleted="handleFolderDeleted"
        />
      </div>

      <!-- 右侧文件列表 -->
      <div class="content">
        <!-- 页面头部 -->
        <div class="page-header">
          <div class="header-left">
            <h1>{{ $t('nav.fileList') }}</h1>
            <div class="stats">
              <span>总计 {{ filesStore.total }} 个文件</span>
              <span v-if="selectedFiles.length > 0">已选择 {{ selectedFiles.length }} 个</span>
            </div>
          </div>

          <div class="header-right">
            <el-button :icon="Delete" @click="showTrashManager = true">
              {{ $t('trash.title') }}
            </el-button>
            <el-button type="primary" :icon="Upload" @click="$router.push('/upload')">
              上传文件
            </el-button>
          </div>
        </div>

        <!-- 工具栏 -->
        <div class="toolbar">
          <div class="toolbar-left">
            <!-- 面包屑导航 -->
            <el-breadcrumb separator="/" class="breadcrumb">
              <el-breadcrumb-item @click="handleRootSelect">
                {{ $t('folder.root') }}
              </el-breadcrumb-item>
              <el-breadcrumb-item
                v-for="folder in breadcrumbPath"
                :key="folder.id"
                @click="handleFolderSelect(folder)"
              >
                {{ folder.name }}
              </el-breadcrumb-item>
            </el-breadcrumb>

            <!-- 搜索 -->
            <el-input
              v-model="searchQuery"
              placeholder="搜索文件名..."
              :prefix-icon="Search"
              clearable
              style="width: 300px"
              @input="handleSearch"
            />

            <!-- 分类筛选 -->
            <el-select
              v-model="categoryFilter"
              placeholder="文件分类"
              clearable
              style="width: 150px"
              @change="handleCategoryChange"
            >
              <el-option
                v-for="category in categories"
                :key="category.value"
                :label="category.label"
                :value="category.value"
              />
            </el-select>

            <!-- 刷新 -->
            <el-button :icon="Refresh" :loading="filesStore.loading" @click="handleRefresh">
              刷新
            </el-button>

            <!-- 同步文件 -->
            <el-dropdown @command="handleSyncCommand">
              <el-button :loading="syncLoading">
                <el-icon><Connection /></el-icon>
                同步
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="validate">
                    <el-icon><View /></el-icon>
                    验证文件完整性
                  </el-dropdown-item>
                  <el-dropdown-item command="sync" divided>
                    <el-icon><Refresh /></el-icon>
                    同步并清理无效记录
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>

          <div class="toolbar-right">
            <!-- 批量操作 -->
            <BatchOperations
              :selected-files="selectedFiles"
              @operation-complete="handleOperationComplete"
            />

            <!-- 视图切换 -->
            <el-radio-group v-model="viewMode" size="small">
              <el-radio-button value="table">
                <el-icon><List /></el-icon>
              </el-radio-button>
              <el-radio-button value="grid">
                <el-icon><Grid /></el-icon>
              </el-radio-button>
            </el-radio-group>
          </div>
        </div>

        <!-- 文件列表 - 表格视图 -->
        <el-card v-if="viewMode === 'table'" class="table-card">
          <el-table
            v-loading="filesStore.loading"
            :data="filesStore.files"
            @selection-change="handleSelectionChange"
            @sort-change="handleSortChange"
          >
            <el-table-column type="selection" width="55" />

            <el-table-column label="文件名" prop="originalName" sortable="custom" min-width="200">
              <template #default="{ row }">
                <div class="file-name-cell">
                  <el-icon class="file-icon" size="20">
                    <Document v-if="row.category === 'documents'" />
                    <Picture v-else-if="row.category === 'images'" />
                    <VideoPlay v-else-if="row.category === 'videos'" />
                    <Headset v-else-if="row.category === 'music'" />
                    <Document v-else />
                  </el-icon>

                  <!-- 内联编辑模式 -->
                  <div v-if="editingFileId === row.id" class="inline-edit">
                    <el-input
                      ref="editInputRef"
                      v-model="editingFileName"
                      size="small"
                      @blur="handleRenameCancel"
                      @keyup.enter="handleRenameSave(row)"
                      @keyup.escape="handleRenameCancel"
                    />
                    <span class="file-extension">{{ getFileExtension(row.originalName) }}</span>
                  </div>

                  <!-- 正常显示模式 -->
                  <div v-else class="file-name-display">
                    <span class="file-name" @click="previewFile(row)">
                      {{ row.originalName }}
                    </span>
                    <el-tooltip content="重命名" placement="top" :show-after="800">
                      <el-button
                        size="small"
                        text
                        class="rename-btn"
                        @click.stop="startRename(row)"
                      >
                        <el-icon><Edit /></el-icon>
                      </el-button>
                    </el-tooltip>
                  </div>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="大小" prop="size" sortable="custom" width="100">
              <template #default="{ row }">
                {{ configStore.formatFileSize(row.size) }}
              </template>
            </el-table-column>

            <el-table-column label="分类" prop="category" width="100">
              <template #default="{ row }">
                <el-tag size="small">{{ getCategoryLabel(row.category) }}</el-tag>
              </template>
            </el-table-column>

            <el-table-column label="访问级别" prop="accessLevel" width="100">
              <template #default="{ row }">
                <el-tag :type="getAccessLevelType(row.accessLevel)" size="small">
                  {{ getAccessLevelLabel(row.accessLevel) }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column label="上传时间" prop="uploadedAt" sortable="custom" width="160">
              <template #default="{ row }">
                {{ formatTime(row.uploadedAt) }}
              </template>
            </el-table-column>

            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <div class="action-buttons">
                  <!-- 主要操作按钮 -->
                  <el-tooltip content="预览" placement="top" :show-after="800">
                    <el-button
                      size="small"
                      text
                      class="action-btn primary-action"
                      @click="previewFile(row)"
                    >
                      <el-icon><View /></el-icon>
                    </el-button>
                  </el-tooltip>

                  <el-tooltip content="下载" placement="top" :show-after="800">
                    <el-button size="small" text class="action-btn" @click="downloadFile(row)">
                      <el-icon><Download /></el-icon>
                    </el-button>
                  </el-tooltip>

                  <el-tooltip
                    v-if="row.category === 'images'"
                    content="编辑"
                    placement="top"
                    :show-after="800"
                  >
                    <el-button size="small" text class="action-btn" @click="editImage(row)">
                      <el-icon><Edit /></el-icon>
                    </el-button>
                  </el-tooltip>

                  <!-- 更多操作下拉菜单 -->
                  <el-dropdown
                    trigger="click"
                    placement="bottom-end"
                    @command="cmd => handleFileAction(cmd, row)"
                  >
                    <el-button size="small" text class="action-btn more-btn">
                      <el-icon><MoreFilled /></el-icon>
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu class="action-dropdown">
                        <el-dropdown-item command="move" :icon="FolderOpened">
                          移动
                        </el-dropdown-item>
                        <el-dropdown-item command="changeCategory" :icon="Collection">
                          更改分类
                        </el-dropdown-item>
                        <el-dropdown-item command="properties" :icon="InfoFilled">
                          属性
                        </el-dropdown-item>
                        <el-dropdown-item command="versions" :icon="Clock">
                          版本历史
                        </el-dropdown-item>
                        <el-dropdown-item command="tags" :icon="PriceTag">
                          管理标签
                        </el-dropdown-item>
                        <el-dropdown-item
                          command="delete"
                          :icon="Delete"
                          divided
                          class="danger-item"
                        >
                          删除
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <!-- 文件列表 - 网格视图 -->
        <div v-else class="grid-view">
          <div v-loading="filesStore.loading" class="file-grid">
            <div
              v-for="file in filesStore.files"
              :key="file.id"
              class="file-card"
              :class="{ selected: filesStore.selectedFiles.includes(file.id) }"
              @click="toggleFileSelection(file.id)"
            >
              <div class="file-thumbnail">
                <img
                  v-if="file.category === 'images'"
                  :src="getThumbnailUrl(file.id)"
                  :alt="file.originalName"
                  @error="handleImageError"
                />
                <el-icon v-else size="48" class="file-type-icon">
                  <Document v-if="file.category === 'documents'" />
                  <VideoPlay v-else-if="file.category === 'videos'" />
                  <Headset v-else-if="file.category === 'music'" />
                  <Document v-else />
                </el-icon>
              </div>

              <div class="file-info">
                <!-- 内联编辑模式 -->
                <div v-if="editingFileId === file.id" class="file-name-edit">
                  <el-input
                    ref="editInputRef"
                    v-model="editingFileName"
                    size="small"
                    @blur="handleRenameCancel"
                    @keyup.enter="handleRenameSave(file)"
                    @keyup.escape="handleRenameCancel"
                  />
                  <span class="file-extension">{{ getFileExtension(file.originalName) }}</span>
                </div>

                <!-- 正常显示模式 -->
                <div v-else class="file-name-display">
                  <div class="file-name" :title="file.originalName">
                    {{ file.originalName }}
                  </div>
                  <el-tooltip content="重命名" placement="top" :show-after="800">
                    <el-button
                      size="small"
                      text
                      class="rename-btn-grid"
                      @click.stop="startRename(file)"
                    >
                      <el-icon><Edit /></el-icon>
                    </el-button>
                  </el-tooltip>
                </div>

                <div class="file-meta">
                  <span>{{ configStore.formatFileSize(file.size) }}</span>
                  <span>{{ formatTime(file.uploadedAt) }}</span>
                </div>
              </div>

              <div class="file-actions">
                <el-button size="small" text @click.stop="previewFile(file)">预览</el-button>
                <el-button size="small" text @click.stop="downloadFile(file)">下载</el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 分页 -->
        <div class="pagination">
          <el-pagination
            v-model:current-page="filesStore.currentPage"
            v-model:page-size="filesStore.pageSize"
            :total="filesStore.total"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handlePageSizeChange"
            @current-change="handlePageChange"
          />
        </div>
      </div>
    </div>

    <!-- 文件预览对话框 -->
    <FilePreview
      v-model="showPreviewDialog"
      :file-info="selectedFile || undefined"
      @file-updated="handleFileUpdated"
    />

    <!-- 图片编辑器 -->
    <ImageEditor v-model="showImageEditor" :file-id="selectedFile?.id" @saved="handleImageSaved" />

    <!-- 文件属性对话框 -->
    <FilePropertiesDialog
      v-model="showPropertiesDialog"
      :file="selectedFile"
      @updated="handleFileUpdated"
    />

    <!-- 移动文件对话框 -->
    <el-dialog
      v-model="showMoveDialog"
      title="移动文件"
      width="520px"
      class="move-file-dialog"
      :close-on-click-modal="false"
    >
      <div class="move-dialog-content">
        <!-- 文件信息卡片 -->
        <div class="single-file-move-card">
          <div class="file-icon">
            <el-icon size="24">
              <component :is="getCategoryIcon(selectedFile?.category || '')" />
            </el-icon>
          </div>
          <div class="file-details">
            <div class="file-title">移动文件</div>
            <div class="file-meta">
              <strong>{{ selectedFile?.originalName }}</strong>
              • {{ configStore.formatFileSize(selectedFile?.size || 0) }} •
              {{ formatTime(selectedFile?.uploadedAt || '') }}
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
      title="更改分类"
      width="520px"
      class="change-category-dialog"
      :close-on-click-modal="false"
    >
      <div class="change-category-dialog-content">
        <!-- 文件信息卡片 -->
        <div class="file-info-card">
          <div class="file-icon">
            <el-icon size="24">
              <component :is="getCategoryIcon(selectedFile?.category || '')" />
            </el-icon>
          </div>
          <div class="file-details">
            <div class="file-name">更改文件分类</div>
            <div class="file-meta">
              <strong>{{ selectedFile?.originalName }}</strong>
              • {{ configStore.formatFileSize(selectedFile?.size || 0) }} • 当前分类：
              <el-tag size="small">{{ getCategoryLabel(selectedFile?.category || '') }}</el-tag>
            </div>
          </div>
        </div>

        <!-- 操作说明 -->
        <div class="operation-description">
          <el-icon class="info-icon"><InfoFilled /></el-icon>
          <span>为文件设置新的分类标记</span>
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

    <!-- 回收站管理 -->
    <TrashManager v-model="showTrashManager" @files-restored="handleFilesRestored" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, reactive, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Upload,
  Search,
  Refresh,
  Delete,
  List,
  Grid,
  Document,
  Picture,
  VideoPlay,
  Headset,
  Edit,
  InfoFilled,
  Clock,
  PriceTag,
  View,
  Download,
  MoreFilled,
  FolderOpened,
  Connection,
  ArrowDown,
  Collection,
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useConfigStore } from '@/stores/config'
import { useFilesStore } from '@/stores/files'
import { useFoldersStore } from '@/stores/folders'
import FilesApi from '@/api/files'
import { FileCategory, FileAccessLevel, type FileInfo, type FolderInfo } from '@/types/file'
import FolderTree from '@/components/FolderTree.vue'
import FilePreview from '@/components/FilePreview.vue'
import ImageEditor from '@/components/ImageEditor.vue'
import BatchOperations from '@/components/BatchOperations.vue'
import TrashManager from '@/components/TrashManager.vue'
import FilePropertiesDialog from '@/components/FilePropertiesDialog.vue'

const { t } = useI18n()
const configStore = useConfigStore()
const filesStore = useFilesStore()
const foldersStore = useFoldersStore()

// 状态
const searchQuery = ref('')
const categoryFilter = ref('')
const viewMode = ref<'table' | 'grid'>('table')
const selectedFile = ref<FileInfo | null>(null)

// 内联编辑状态
const editingFileId = ref<string | null>(null)
const editingFileName = ref('')
const editInputRef = ref()
const selectedFiles = ref<FileInfo[]>([])
const currentFolderId = ref<string>()
const breadcrumbPath = ref<FolderInfo[]>([])

// 对话框状态
const showPreviewDialog = ref(false)
const showImageEditor = ref(false)
const showPropertiesDialog = ref(false)
const showTrashManager = ref(false)
const showMoveDialog = ref(false)
const showChangeCategoryDialog = ref(false)
const processing = ref(false)

// 同步状态
const syncLoading = ref(false)

// 移动表单
const moveForm = reactive({
  folderId: '',
})

// 更改分类表单
const changeCategoryForm = reactive({
  category: '',
})

// 文件夹树属性配置
const folderTreeProps = {
  children: 'children',
  label: 'name',
  value: 'id',
}

// 计算属性
const categories = computed(() => [
  { label: t('file.categories.images'), value: FileCategory.IMAGE },
  { label: t('file.categories.documents'), value: FileCategory.DOCUMENT },
  { label: t('file.categories.music'), value: FileCategory.MUSIC },
  { label: t('file.categories.videos'), value: FileCategory.VIDEO },
  { label: t('file.categories.archives'), value: FileCategory.ARCHIVE },
])

// 方法
const getCategoryLabel = (category: string) => {
  const item = categories.value.find(c => c.value === category)
  return item?.label || category
}

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

const getAccessLevelLabel = (level: string) => {
  switch (level) {
    case FileAccessLevel.PUBLIC:
      return t('file.accessLevels.public')
    case FileAccessLevel.PRIVATE:
      return t('file.accessLevels.private')
    case FileAccessLevel.PROTECTED:
      return t('file.accessLevels.protected')
    default:
      return level
  }
}

const getAccessLevelType = (level: string) => {
  switch (level) {
    case FileAccessLevel.PUBLIC:
      return 'success'
    case FileAccessLevel.PRIVATE:
      return 'danger'
    case FileAccessLevel.PROTECTED:
      return 'warning'
    default:
      return 'info'
  }
}

const formatTime = (time: string) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

const getThumbnailUrl = (id: string) => {
  return FilesApi.getThumbnailUrl(id, 'medium')
}

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

// 事件处理
const handleSearch = () => {
  filesStore.setSearch(searchQuery.value)
}

const handleCategoryChange = () => {
  filesStore.setCategoryFilter(categoryFilter.value)
}

const handleRefresh = () => {
  filesStore.refreshFiles()
}

// 同步相关方法
const handleSyncCommand = async (command: string) => {
  if (syncLoading.value) return

  syncLoading.value = true
  try {
    if (command === 'validate') {
      await handleValidateFiles()
    } else if (command === 'sync') {
      await handleSyncFiles()
    }
  } catch (error) {
    console.error('同步操作失败:', error)
    ElMessage.error('同步操作失败')
  } finally {
    syncLoading.value = false
  }
}

const handleValidateFiles = async () => {
  try {
    const result = await FilesApi.validateFileIntegrity()

    if (result.missingFiles.length === 0) {
      ElMessage.success(`文件验证完成，所有 ${result.totalFiles} 个文件都存在`)
    } else {
      const missingFileNames = result.missingFiles.map(f => f.originalName).join(', ')
      await ElMessageBox.alert(
        `发现 ${result.missingFiles.length} 个缺失文件：\n${missingFileNames}`,
        '文件完整性验证结果',
        {
          type: 'warning',
          confirmButtonText: '确定',
        }
      )
    }

    if (result.errors.length > 0) {
      console.warn('验证过程中的错误:', result.errors)
    }
  } catch (error) {
    console.error('验证文件完整性失败:', error)
    ElMessage.error('验证文件完整性失败')
  }
}

const handleSyncFiles = async () => {
  try {
    await ElMessageBox.confirm(
      '此操作将清理所有指向不存在文件的记录，确认继续吗？',
      '同步文件确认',
      {
        type: 'warning',
        confirmButtonText: '确认同步',
        cancelButtonText: '取消',
      }
    )

    const result = await FilesApi.syncFileMetadata()

    if (result.removedFiles.length === 0) {
      ElMessage.success(`同步完成，所有 ${result.totalFiles} 个文件记录都有效`)
    } else {
      const removedFileNames = result.removedFiles.join('\n')
      await ElMessageBox.alert(
        `同步完成，已清理 ${result.removedFiles.length} 个无效记录：\n${removedFileNames}`,
        '文件同步结果',
        {
          type: 'success',
          confirmButtonText: '确定',
        }
      )
    }

    if (result.errors.length > 0) {
      console.warn('同步过程中的错误:', result.errors)
    }

    // 刷新文件列表和文件夹统计
    await filesStore.refreshFiles()
    await foldersStore.refreshFolders()

    // 刷新文件夹统计信息
    try {
      await FilesApi.refreshFolderStats()
      console.log('文件夹统计信息已刷新')
    } catch (error) {
      console.warn('刷新文件夹统计信息失败:', error)
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('同步文件失败:', error)
      ElMessage.error('同步文件失败')
    }
  }
}

const handleSelectionChange = (selection: FileInfo[]) => {
  selectedFiles.value = selection
  filesStore.selectedFiles = selection.map(file => file.id)
}

const handleSortChange = ({ prop, order }: any) => {
  const sortOrder = order === 'ascending' ? 'asc' : 'desc'
  filesStore.setSorting(prop, sortOrder)
}

const handlePageChange = (page: number) => {
  filesStore.setPage(page)
}

const handlePageSizeChange = (size: number) => {
  filesStore.setPageSize(size)
}

const toggleFileSelection = (id: string) => {
  filesStore.toggleFileSelection(id)
}

// 文件夹相关方法
const handleRootSelect = () => {
  // 选择根目录时，实际上是选择"全部"文件夹
  const allFolder = foldersStore.folderTree.find(folder => folder.id === 'all')
  if (allFolder) {
    handleFolderSelect(allFolder)
  }
}

const handleFolderSelect = (folder: FolderInfo | null) => {
  currentFolderId.value = folder?.id
  updateBreadcrumbPath(folder)
  // 根据文件夹筛选文件，【全部】文件夹显示所有文件
  if (folder?.id === 'all') {
    filesStore.setFolderFilter('all') // 使用 'all' 作为特殊标识
  } else {
    filesStore.setFolderFilter(folder?.id)
  }
  // setFolderFilter 内部已经调用了 loadFiles()，不需要再调用 refreshFiles()
}

const updateBreadcrumbPath = (folder: FolderInfo | null) => {
  if (!folder) {
    breadcrumbPath.value = []
    return
  }

  // 【全部】文件夹只显示自己
  if (folder.id === 'all') {
    breadcrumbPath.value = [folder]
    return
  }

  // 构建面包屑路径
  const path: FolderInfo[] = []
  let current: FolderInfo | null = folder
  while (current) {
    path.unshift(current)
    current = current.parentId ? findFolderById(current.parentId) : null
  }
  breadcrumbPath.value = path
}

const findFolderById = (id: string): FolderInfo | null => {
  // 从文件夹列表中查找
  return foldersStore.folders.find(folder => folder.id === id) || null
}

const handleFolderCreated = (folder: FolderInfo) => {
  // 成功提示已在 FolderTree 组件中显示，这里不需要重复显示
  // 文件夹创建不影响当前文件列表，无需刷新
}

const handleFolderUpdated = (folder: FolderInfo) => {
  // 成功提示已在 FolderTree 组件中显示，这里不需要重复显示
  // 文件夹重命名不影响当前文件列表，无需刷新
}

const handleFolderDeleted = (folderId: string) => {
  if (currentFolderId.value === folderId) {
    // 如果删除的是当前选中的文件夹，切换到【全部】文件夹
    const allFolder = foldersStore.folderTree.find(folder => folder.id === 'all')
    if (allFolder) {
      handleFolderSelect(allFolder)
    } else {
      handleFolderSelect(null)
    }
  }
  // 成功提示已在 FolderTree 组件中显示，这里不需要重复显示
}

// 文件预览和编辑
const previewFile = (file: FileInfo) => {
  selectedFile.value = file
  showPreviewDialog.value = true
}

const editImage = (file: FileInfo) => {
  selectedFile.value = file
  showImageEditor.value = true
}

const downloadFile = async (file: FileInfo) => {
  try {
    await FilesApi.downloadFile(file.id, file.originalName)
  } catch (error) {
    ElMessage.error('下载失败')
  }
}

// 内联编辑相关方法
const getFileExtension = (filename: string): string => {
  const lastDotIndex = filename.lastIndexOf('.')
  return lastDotIndex > 0 ? filename.substring(lastDotIndex) : ''
}

const getFileNameWithoutExtension = (filename: string): string => {
  const lastDotIndex = filename.lastIndexOf('.')
  return lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename
}

const startRename = (file: FileInfo) => {
  editingFileId.value = file.id
  editingFileName.value = getFileNameWithoutExtension(file.originalName)

  // 下一个tick后聚焦输入框并选中文本
  nextTick(() => {
    const input = editInputRef.value?.$el?.querySelector('input')
    if (input) {
      input.focus()
      input.select()
    }
  })
}

const handleRenameCancel = () => {
  editingFileId.value = null
  editingFileName.value = ''
}

const handleRenameSave = async (file: FileInfo) => {
  if (!editingFileName.value.trim()) {
    ElMessage.error('文件名不能为空')
    return
  }

  // 检查文件名是否包含非法字符
  const invalidChars = /[<>:"/\\|?*]/
  if (invalidChars.test(editingFileName.value)) {
    ElMessage.error('文件名不能包含以下字符：< > : " / \\ | ? *')
    return
  }

  const extension = getFileExtension(file.originalName)
  const newFileName = editingFileName.value.trim() + extension

  // 检查是否有变化
  if (newFileName === file.originalName) {
    handleRenameCancel()
    return
  }

  try {
    await FilesApi.updateFile(file.id, {
      filename: newFileName,
    })

    ElMessage.success('重命名成功')
    handleRenameCancel()
    await filesStore.refreshFiles()
  } catch (error) {
    ElMessage.error('重命名失败')
  }
}

const handleFileAction = (command: string, file: FileInfo) => {
  selectedFile.value = file

  switch (command) {
    case 'move':
      // 初始化移动表单，设置默认值
      initializeMoveForm(file)
      showMoveDialog.value = true
      break
    case 'changeCategory':
      // 初始化更改分类表单，设置默认值
      initializeChangeCategoryForm(file)
      showChangeCategoryDialog.value = true
      break
    case 'properties':
      showPropertiesDialog.value = true
      break
    case 'versions':
      handleFileVersions(file)
      break
    case 'tags':
      handleFileTags(file)
      break
    case 'delete':
      handleDeleteFile(file)
      break
  }
}

// 初始化移动表单
const initializeMoveForm = (file: FileInfo) => {
  // 设置目标文件夹为当前文件所属文件夹
  moveForm.folderId = file.folderId || currentFolderId.value || 'all'
}

// 初始化更改分类表单
const initializeChangeCategoryForm = (file: FileInfo) => {
  // 设置当前文件的分类
  changeCategoryForm.category = file.category
}

const handleChangeCategoryConfirm = async () => {
  try {
    processing.value = true

    if (!selectedFile.value) {
      ElMessage.error('请选择要更改分类的文件')
      return
    }

    const currentFile = selectedFile.value
    const targetCategory = changeCategoryForm.category

    // 检查是否有实际的更改
    if (targetCategory === currentFile.category) {
      ElMessage.info('分类没有更改')
      showChangeCategoryDialog.value = false
      return
    }

    // 更新分类标记（不移动物理文件）
    const updates = {
      category: targetCategory as FileCategory,
    }
    await FilesApi.updateFile(currentFile.id, updates)

    showChangeCategoryDialog.value = false
    changeCategoryForm.category = ''

    ElMessage.success('文件分类更新成功')
    // 刷新文件列表
    await filesStore.refreshFiles()
  } catch (error) {
    console.error('Failed to change category:', error)
    ElMessage.error('更改分类失败')
  } finally {
    processing.value = false
  }
}

const handleFileVersions = (file: FileInfo) => {
  // 显示文件版本历史对话框
  ElMessage.info(t('file.versionsNotImplemented'))
}

const handleFileTags = (file: FileInfo) => {
  // 显示文件标签管理对话框
  ElMessage.info(t('file.tagsNotImplemented'))
}

const handleDeleteFile = async (file: FileInfo) => {
  try {
    await ElMessageBox.confirm(`确认删除文件 "${file.originalName}" 吗？`, '删除确认', {
      type: 'warning',
    })

    await filesStore.deleteFile(file.id)
    ElMessage.success('删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const handleMoveConfirm = async () => {
  try {
    processing.value = true

    if (!selectedFile.value) {
      ElMessage.error('请选择要移动的文件')
      return
    }

    const currentFile = selectedFile.value
    const targetFolderId = moveForm.folderId

    // 检查是否有实际的更改
    if (targetFolderId === (currentFile.folderId || currentFolderId.value || 'all')) {
      ElMessage.info('文件夹没有更改')
      showMoveDialog.value = false
      return
    }

    // 执行文件夹移动操作
    await FilesApi.moveFilesToFolder([currentFile.id], targetFolderId)

    showMoveDialog.value = false
    moveForm.folderId = ''

    ElMessage.success('文件移动成功')
    // 先刷新文件列表，再刷新文件夹统计
    await filesStore.refreshFiles()
    await foldersStore.refreshFolders()
  } catch (error) {
    console.error('Failed to move file:', error)
    ElMessage.error('移动失败')
  } finally {
    processing.value = false
  }
}

const handleBatchAction = async (command: string) => {
  if (command === 'delete') {
    try {
      await ElMessageBox.confirm(
        `确认删除选中的 ${filesStore.selectedCount} 个文件吗？`,
        '批量删除确认',
        {
          type: 'warning',
        }
      )

      await filesStore.deleteSelectedFiles()
      ElMessage.success('批量删除成功')
    } catch (error) {
      if (error !== 'cancel') {
        ElMessage.error('批量删除失败')
      }
    }
  }
}

// 批量操作处理
const handleOperationComplete = async (operation: string, count: number) => {
  // 只有移动和更改分类操作需要在这里显示消息，其他操作已在 BatchOperations 组件中显示
  if (operation === 'move' || operation === 'changeCategory') {
    ElMessage.success(t(`batch.${operation}Success`, { count }))
  }
  // 先刷新文件列表，再刷新文件夹统计
  await filesStore.refreshFiles()
  await foldersStore.refreshFolders()
  selectedFiles.value = []
}

// 回收站相关
const handleFilesRestored = (count: number) => {
  // 不显示消息，因为 TrashManager 已经显示了
  filesStore.refreshFiles()
}

// 图片编辑完成
const handleImageSaved = () => {
  // 不显示消息，因为 ImageEditor 已经显示了
  filesStore.refreshFiles()
  showImageEditor.value = false
}

const handleFileUpdated = () => {
  filesStore.refreshFiles()
  showPropertiesDialog.value = false
}

// 监听器
watch(
  () => filesStore.searchQuery,
  newVal => {
    searchQuery.value = newVal
  }
)

watch(
  () => filesStore.categoryFilter,
  newVal => {
    categoryFilter.value = newVal
  }
)

// 生命周期
onMounted(async () => {
  // 强制刷新文件夹列表，确保统计信息是最新的
  try {
    await foldersStore.refreshFolders()
  } catch (error) {
    console.error('Failed to refresh folders:', error)
  }
  // 不在这里加载文件，等待文件夹选择后再加载
  // filesStore.loadFiles()
})
</script>

<style scoped lang="scss">
.file-list-page {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 280px;
  border-right: 1px solid var(--el-border-color-light);
  background-color: var(--el-bg-color);
  overflow: hidden;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.header-left h1 {
  margin: 0 0 8px 0;
  color: var(--el-text-color-primary);
}

.stats {
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 16px;
  background-color: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color);
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.breadcrumb {
  margin-right: 16px;
}

.breadcrumb :deep(.el-breadcrumb__item) {
  cursor: pointer;
}

.breadcrumb :deep(.el-breadcrumb__item:hover) {
  color: var(--el-color-primary);
}

.table-card {
  flex: 1;
  margin-bottom: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.table-card :deep(.el-card__body) {
  height: 100%;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.table-card :deep(.el-table) {
  flex: 1;
  overflow: auto;
}

.table-card :deep(.el-table__body-wrapper) {
  overflow-y: auto;
  max-height: calc(100vh - 300px);
}

.file-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-icon {
  color: var(--el-color-primary);
}

.file-name {
  cursor: pointer;
  color: var(--el-color-primary);
  text-decoration: none;
}

.file-name:hover {
  text-decoration: underline;
}

/* 内联编辑样式 */
.inline-edit {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.inline-edit .el-input {
  flex: 1;
}

.file-extension {
  color: var(--el-text-color-regular);
  font-size: 14px;
  white-space: nowrap;
}

.file-name-display {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.rename-btn {
  opacity: 0;
  transition: opacity 0.2s;
  padding: 4px;
  margin-left: 4px;
}

.file-name-cell:hover .rename-btn {
  opacity: 1;
}

.rename-btn:hover {
  color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}

/* 网格视图中的重命名按钮 */
.file-name-edit {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}

.file-name-edit .el-input {
  flex: 1;
}

.file-name-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rename-btn-grid {
  opacity: 0;
  transition: opacity 0.2s;
  padding: 2px;
  margin-left: 4px;
}

.file-card:hover .rename-btn-grid {
  opacity: 1;
}

/* 操作按钮样式优化 */
.action-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-start;
  padding: 0 8px;
}

.action-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 6px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background-color: var(--el-fill-color-light);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .el-icon {
    font-size: 16px;
    color: var(--el-text-color-regular);
  }

  &.primary-action {
    .el-icon {
      color: var(--el-color-primary);
    }

    &:hover {
      background-color: var(--el-color-primary-light-9);

      .el-icon {
        color: var(--el-color-primary-dark-2);
      }
    }
  }

  &.more-btn {
    .el-icon {
      color: var(--el-text-color-secondary);
    }

    &:hover {
      .el-icon {
        color: var(--el-text-color-primary);
      }
    }
  }
}

/* 下拉菜单样式优化 */
.action-dropdown {
  border-radius: 8px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  border: 1px solid var(--el-border-color-lighter);
  overflow: hidden;

  .el-dropdown-menu__item {
    padding: 8px 16px;
    font-size: 13px;
    transition: all 0.2s ease;

    &:hover {
      background-color: var(--el-fill-color-light);
    }

    &.danger-item {
      color: var(--el-color-danger);

      &:hover {
        background-color: var(--el-color-danger-light-9);
        color: var(--el-color-danger-dark-2);
      }
    }

    .el-icon {
      margin-right: 8px;
      font-size: 14px;
    }
  }
}

.grid-view {
  flex: 1;
  margin-bottom: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.grid-view :deep(.el-card__body) {
  height: 100%;
  padding: 0;
  overflow: hidden;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  padding: 16px;
  overflow-y: auto;
  height: calc(100vh - 300px);
}

.file-card {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 16px;
  background-color: var(--el-bg-color);
  cursor: pointer;
  transition: all 0.3s;
}

.file-card:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.file-card.selected {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}

.file-thumbnail {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 120px;
  margin-bottom: 12px;
  background-color: var(--el-bg-color-page);
  border-radius: 6px;
}

.file-thumbnail img {
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.file-type-icon {
  color: var(--el-color-primary);
}

.file-info {
  margin-bottom: 12px;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: flex;
  justify-content: space-between;
}

.file-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.pagination {
  display: flex;
  justify-content: center;
  padding: 16px 0;
  flex-shrink: 0;
  background-color: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color);
}

/* 移动文件对话框样式 */
.move-file-dialog {
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

.move-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.file-info-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(
    135deg,
    var(--el-color-primary-light-9) 0%,
    var(--el-color-primary-light-8) 100%
  );
  border-radius: 8px;
  border: 1px solid var(--el-color-primary-light-7);

  .file-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: var(--el-color-primary-light-8);
    border-radius: 8px;
    color: var(--el-color-primary);
  }

  .file-details {
    flex: 1;
    min-width: 0;

    .file-name {
      font-size: 16px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      margin-bottom: 4px;
      word-break: break-all;
    }

    .file-meta {
      font-size: 13px;
      color: var(--el-text-color-secondary);
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;

      strong {
        color: var(--el-color-primary);
        font-weight: 600;
      }
    }
  }
}

.single-file-move-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(
    135deg,
    var(--el-color-primary-light-9) 0%,
    var(--el-color-primary-light-8) 100%
  );
  border-radius: 8px;
  border: 1px solid var(--el-color-primary-light-7);

  .file-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: var(--el-color-primary-light-8);
    border-radius: 8px;
    color: var(--el-color-primary);
  }

  .file-details {
    flex: 1;
    min-width: 0;

    .file-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      margin-bottom: 4px;
    }

    .file-meta {
      font-size: 13px;
      color: var(--el-text-color-secondary);
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;

      strong {
        color: var(--el-color-primary);
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

.move-form {
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

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 更改分类对话框样式 */
.change-category-dialog {
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

.change-category-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: 20px;
}

.category-form {
  .el-form-item {
    margin-bottom: 0;
  }

  .el-form-item__label {
    font-weight: 500;
    color: var(--el-text-color-primary);
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
</style>
