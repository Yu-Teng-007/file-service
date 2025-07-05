const fs = require('fs').promises
const path = require('path')
const { v4: uuidv4 } = require('uuid')

/**
 * 修复文件夹统计问题的脚本
 * 问题：
 * 1. folders.json文件为空，但物理文件夹存在
 * 2. 文件的folderId为null，导致统计不正确
 */

const UPLOAD_DIR = 'uploads'
const FOLDERS_JSON = path.join(UPLOAD_DIR, 'folders.json')
const METADATA_JSON = path.join(UPLOAD_DIR, 'metadata.json')
const FOLDERS_DIR = path.join(UPLOAD_DIR, 'folders')

async function main() {
  console.log('开始修复文件夹统计问题...')

  try {
    // 1. 创建"全部"文件夹的后端记录
    await createAllFolder()

    // 2. 检查并修复folders.json
    await fixFoldersJson()

    // 3. 检查并修复文件的folderId关联
    await fixFileAssociations()

    // 4. 重新计算文件夹统计信息
    await recalculateFolderStats()

    console.log('✅ 文件夹统计问题修复完成！')
  } catch (error) {
    console.error('❌ 修复过程中出现错误:', error)
    process.exit(1)
  }
}

/**
 * 创建"全部"文件夹的后端记录
 */
async function createAllFolder() {
  console.log('\n📂 创建"全部"文件夹的后端记录...')

  try {
    // 读取现有的folders.json
    let folders = []
    try {
      const foldersContent = await fs.readFile(FOLDERS_JSON, 'utf-8')
      folders = JSON.parse(foldersContent)
    } catch (error) {
      console.log('folders.json文件不存在，将创建新的')
    }

    // 检查是否已存在"全部"文件夹记录
    const allFolderExists = folders.some(f => f.id === 'all')

    if (!allFolderExists) {
      const now = new Date().toISOString()
      const allFolder = {
        id: 'all',
        name: '全部',
        path: '/',
        parentId: null,
        fileCount: 0,
        totalSize: 0,
        createdAt: now,
        updatedAt: now,
        isSystem: true, // 标记为系统文件夹
      }

      // 将"全部"文件夹添加到列表开头
      folders.unshift(allFolder)

      // 保存更新后的folders.json
      await fs.writeFile(FOLDERS_JSON, JSON.stringify(folders, null, 2))
      console.log('✅ 已创建"全部"文件夹的后端记录')
    } else {
      console.log('✅ "全部"文件夹记录已存在')
    }
  } catch (error) {
    console.error('创建"全部"文件夹记录时出错:', error)
    throw error
  }
}

/**
 * 修复folders.json文件
 */
async function fixFoldersJson() {
  console.log('\n📁 检查folders.json文件...')

  try {
    // 读取现有的folders.json
    let folders = []
    try {
      const foldersContent = await fs.readFile(FOLDERS_JSON, 'utf-8')
      folders = JSON.parse(foldersContent)
      console.log(`当前folders.json中有 ${folders.length} 个文件夹记录`)
    } catch (error) {
      console.log('folders.json文件不存在或为空，将创建新的')
    }

    // 扫描物理文件夹目录
    let physicalFolders = []
    try {
      const entries = await fs.readdir(FOLDERS_DIR, { withFileTypes: true })
      physicalFolders = entries.filter(entry => entry.isDirectory()).map(entry => entry.name)
      console.log(`发现 ${physicalFolders.length} 个物理文件夹:`, physicalFolders)
    } catch (error) {
      console.log('folders目录不存在或为空')
      return
    }

    // 为每个物理文件夹创建元数据记录（如果不存在）
    const now = new Date().toISOString()
    let addedCount = 0

    for (const folderId of physicalFolders) {
      // 检查是否已存在记录
      const existingFolder = folders.find(f => f.id === folderId)
      if (!existingFolder) {
        // 创建新的文件夹记录
        const newFolder = {
          id: folderId,
          name: `文件夹_${folderId.substring(0, 8)}`, // 使用ID前8位作为默认名称
          path: `/文件夹_${folderId.substring(0, 8)}`,
          parentId: null,
          fileCount: 0,
          totalSize: 0,
          createdAt: now,
          updatedAt: now,
        }

        folders.push(newFolder)
        addedCount++
        console.log(`✅ 添加文件夹记录: ${newFolder.name} (${folderId})`)
      }
    }

    // 保存更新后的folders.json
    if (addedCount > 0) {
      await fs.writeFile(FOLDERS_JSON, JSON.stringify(folders, null, 2))
      console.log(`✅ 已添加 ${addedCount} 个文件夹记录到folders.json`)
    } else {
      console.log('✅ folders.json已是最新状态')
    }
  } catch (error) {
    console.error('修复folders.json时出错:', error)
    throw error
  }
}

/**
 * 修复文件的folderId关联
 */
async function fixFileAssociations() {
  console.log('\n🔗 检查文件的文件夹关联...')

  try {
    // 读取文件元数据
    let fileMetadata = {}
    try {
      const metadataContent = await fs.readFile(METADATA_JSON, 'utf-8')
      fileMetadata = JSON.parse(metadataContent)
      console.log(`发现 ${Object.keys(fileMetadata).length} 个文件记录`)
    } catch (error) {
      console.log('metadata.json文件不存在或为空')
      return
    }

    // 读取文件夹信息
    let folders = []
    try {
      const foldersContent = await fs.readFile(FOLDERS_JSON, 'utf-8')
      folders = JSON.parse(foldersContent)
    } catch (error) {
      console.log('无法读取folders.json，跳过文件关联修复')
      return
    }

    let updatedCount = 0

    // 检查每个文件的folderId
    for (const [fileId, metadata] of Object.entries(fileMetadata)) {
      if (!metadata.folderId || metadata.folderId === null) {
        // 尝试从文件路径推断文件夹
        const filePath = metadata.path || ''

        // 检查文件是否在folders目录下
        const foldersMatch = filePath.match(/folders[\\\/]([^\\\/]+)[\\\/]/)
        if (foldersMatch) {
          const inferredFolderId = foldersMatch[1]

          // 验证这个文件夹ID是否存在
          const folderExists = folders.some(f => f.id === inferredFolderId)
          if (folderExists) {
            metadata.folderId = inferredFolderId
            updatedCount++
            console.log(`✅ 更新文件 ${metadata.originalName} 的folderId为: ${inferredFolderId}`)
          }
        } else {
          // 如果文件不在folders目录下，将其关联到"全部"文件夹
          metadata.folderId = 'all'
          updatedCount++
          console.log(`✅ 将文件 ${metadata.originalName} 关联到"全部"文件夹`)
        }
      }
    }

    // 保存更新后的metadata.json
    if (updatedCount > 0) {
      await fs.writeFile(METADATA_JSON, JSON.stringify(fileMetadata, null, 2))
      console.log(`✅ 已更新 ${updatedCount} 个文件的文件夹关联`)
    } else {
      console.log('✅ 所有文件的文件夹关联都是正确的')
    }
  } catch (error) {
    console.error('修复文件关联时出错:', error)
    throw error
  }
}

/**
 * 重新计算文件夹统计信息
 */
async function recalculateFolderStats() {
  console.log('\n📊 重新计算文件夹统计信息...')

  try {
    // 读取文件夹信息
    let folders = []
    try {
      const foldersContent = await fs.readFile(FOLDERS_JSON, 'utf-8')
      folders = JSON.parse(foldersContent)
    } catch (error) {
      console.log('无法读取folders.json，跳过统计计算')
      return
    }

    // 读取文件元数据
    let fileMetadata = {}
    try {
      const metadataContent = await fs.readFile(METADATA_JSON, 'utf-8')
      fileMetadata = JSON.parse(metadataContent)
    } catch (error) {
      console.log('无法读取metadata.json，跳过统计计算')
      return
    }

    // 为每个文件夹计算统计信息
    for (const folder of folders) {
      let fileCount = 0
      let totalSize = 0

      // 统计属于该文件夹的文件
      for (const [fileId, metadata] of Object.entries(fileMetadata)) {
        if (metadata.folderId === folder.id) {
          fileCount++
          totalSize += metadata.size || 0
        }
      }

      // 更新文件夹统计信息
      folder.fileCount = fileCount
      folder.totalSize = totalSize
      folder.updatedAt = new Date().toISOString()

      console.log(`📁 ${folder.name}: ${fileCount} 个文件, ${formatFileSize(totalSize)}`)
    }

    // 保存更新后的folders.json
    await fs.writeFile(FOLDERS_JSON, JSON.stringify(folders, null, 2))
    console.log('✅ 文件夹统计信息已更新')
  } catch (error) {
    console.error('重新计算统计信息时出错:', error)
    throw error
  }
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 显示修复前后的对比
 */
async function showSummary() {
  console.log('\n📋 修复结果摘要:')

  try {
    // 读取文件夹信息
    const foldersContent = await fs.readFile(FOLDERS_JSON, 'utf-8')
    const folders = JSON.parse(foldersContent)

    // 读取文件元数据
    const metadataContent = await fs.readFile(METADATA_JSON, 'utf-8')
    const fileMetadata = JSON.parse(metadataContent)

    console.log(`📁 总文件夹数: ${folders.length}`)
    console.log(`📄 总文件数: ${Object.keys(fileMetadata).length}`)

    let totalFilesInFolders = 0
    let totalSizeInFolders = 0

    folders.forEach(folder => {
      totalFilesInFolders += folder.fileCount
      totalSizeInFolders += folder.totalSize
      if (folder.fileCount > 0) {
        console.log(
          `  📁 ${folder.name}: ${folder.fileCount} 个文件, ${formatFileSize(folder.totalSize)}`
        )
      }
    })

    console.log(`📊 文件夹中的文件总数: ${totalFilesInFolders}`)
    console.log(`📊 文件夹中的文件总大小: ${formatFileSize(totalSizeInFolders)}`)

    // 检查未关联到文件夹的文件
    const unassignedFiles = Object.values(fileMetadata).filter(file => !file.folderId)
    if (unassignedFiles.length > 0) {
      console.log(`⚠️  还有 ${unassignedFiles.length} 个文件未关联到文件夹`)
    }
  } catch (error) {
    console.error('显示摘要时出错:', error)
  }
}

// 运行主函数
if (require.main === module) {
  main()
    .then(async () => {
      await showSummary()
    })
    .catch(error => {
      console.error('脚本执行失败:', error)
      process.exit(1)
    })
}
