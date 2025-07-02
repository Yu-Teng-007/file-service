<template>
  <div class="file-list-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1>{{ $t('nav.fileList') }}</h1>
        <div class="stats">
          <span>总计 {{ filesStore.total }} 个文件</span>
          <span v-if="filesStore.hasSelection">已选择 {{ filesStore.selectedCount }} 个</span>
        </div>
      </div>

      <div class="header-right">
        <el-button type="primary" :icon="Upload" @click="$router.push('/upload')">
          上传文件
        </el-button>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
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
      </div>

      <div class="toolbar-right">
        <!-- 批量操作 -->
        <el-dropdown v-if="filesStore.hasSelection" @command="handleBatchAction">
          <el-button type="danger">
            批量操作
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="delete">
                <el-icon><Delete /></el-icon>
                删除选中文件
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

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
              <span class="file-name" @click="previewFile(row)">
                {{ row.originalName }}
              </span>
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
              <el-button size="small" text @click="previewFile(row)">预览</el-button>
              <el-button size="small" text @click="downloadFile(row)">下载</el-button>
              <el-dropdown @command="cmd => handleFileAction(cmd, row)">
                <el-button size="small" text>
                  更多
                  <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="rename">重命名</el-dropdown-item>
                    <el-dropdown-item command="properties">属性</el-dropdown-item>
                    <el-dropdown-item command="delete" divided>
                      <span style="color: var(--el-color-danger)">删除</span>
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
            <div class="file-name" :title="file.originalName">
              {{ file.originalName }}
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

    <!-- 文件属性对话框 -->
    <FilePropertiesDialog
      v-model="showPropertiesDialog"
      :file="selectedFile"
      @updated="handleFileUpdated"
    />

    <!-- 重命名对话框 -->
    <RenameDialog v-model="showRenameDialog" :file="selectedFile" @renamed="handleFileRenamed" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Upload,
  Search,
  Refresh,
  ArrowDown,
  Delete,
  List,
  Grid,
  Document,
  Picture,
  VideoPlay,
  Headset,
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useConfigStore } from '@/stores/config'
import { useFilesStore } from '@/stores/files'
import FilesApi from '@/api/files'
import { FileCategory, FileAccessLevel, type FileInfo } from '@/types/file'
import FilePropertiesDialog from '@/components/FilePropertiesDialog.vue'
import RenameDialog from '@/components/RenameDialog.vue'

const { t } = useI18n()
const configStore = useConfigStore()
const filesStore = useFilesStore()

// 状态
const searchQuery = ref('')
const categoryFilter = ref('')
const viewMode = ref<'table' | 'grid'>('table')
const selectedFile = ref<FileInfo | null>(null)
const showPropertiesDialog = ref(false)
const showRenameDialog = ref(false)

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
      return ''
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

const handleSelectionChange = (selection: FileInfo[]) => {
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

const previewFile = (file: FileInfo) => {
  const previewUrl = FilesApi.getPreviewUrl(file.id)
  window.open(previewUrl, '_blank')
}

const downloadFile = async (file: FileInfo) => {
  try {
    await FilesApi.downloadFile(file.id, file.originalName)
  } catch (error) {
    ElMessage.error('下载失败')
  }
}

const handleFileAction = (command: string, file: FileInfo) => {
  selectedFile.value = file

  switch (command) {
    case 'rename':
      showRenameDialog.value = true
      break
    case 'properties':
      showPropertiesDialog.value = true
      break
    case 'delete':
      handleDeleteFile(file)
      break
  }
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

const handleFileUpdated = () => {
  filesStore.refreshFiles()
  showPropertiesDialog.value = false
}

const handleFileRenamed = () => {
  filesStore.refreshFiles()
  showRenameDialog.value = false
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
onMounted(() => {
  filesStore.loadFiles()
})
</script>

<style scoped>
.file-list-page {
  height: calc(100vh - 60px);
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 20px;
  box-sizing: border-box;
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
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
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

.action-buttons {
  display: flex;
  gap: 8px;
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
  margin-bottom: 4px;
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
</style>
