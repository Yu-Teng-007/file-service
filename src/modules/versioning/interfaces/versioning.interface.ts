export interface FileVersion {
  id: string
  fileId: string
  version: number
  fileName: string
  filePath: string
  size: number
  mimeType: string
  checksum: string
  createdAt: Date
  createdBy?: string
  comment?: string
  tags?: string[]
  metadata?: Record<string, any>
  isActive: boolean
  parentVersionId?: string
}

export interface VersionHistory {
  fileId: string
  fileName: string
  currentVersion: number
  totalVersions: number
  versions: FileVersion[]
  totalSize: number
  createdAt: Date
  lastModified: Date
}

export interface VersionDiff {
  versionA: FileVersion
  versionB: FileVersion
  changes: Array<{
    type: 'added' | 'removed' | 'modified'
    path?: string
    oldValue?: any
    newValue?: any
    description: string
  }>
  similarity: number // 0-1
}

export interface VersioningConfig {
  maxVersionsPerFile: number
  enableAutoVersioning: boolean
  versionRetentionDays: number
  enableDiffGeneration: boolean
  compressionEnabled: boolean
  storageLocation: 'local' | 'cdn'
}

export interface CreateVersionOptions {
  comment?: string
  tags?: string[]
  metadata?: Record<string, any>
  createdBy?: string
  preserveOriginal?: boolean
}

export interface RestoreOptions {
  targetVersionId: string
  createBackup?: boolean
  comment?: string
  createdBy?: string
}

export interface VersionSearchQuery {
  fileId?: string
  fileName?: string
  version?: number
  createdBy?: string
  dateFrom?: Date
  dateTo?: Date
  tags?: string[]
  limit?: number
  offset?: number
  sortBy?: 'version' | 'createdAt' | 'size'
  sortOrder?: 'asc' | 'desc'
}

export interface VersionStats {
  totalFiles: number
  totalVersions: number
  totalSize: number
  averageVersionsPerFile: number
  oldestVersion: Date
  newestVersion: Date
  topVersionedFiles: Array<{
    fileId: string
    fileName: string
    versionCount: number
    totalSize: number
  }>
}

export interface BranchInfo {
  id: string
  name: string
  description?: string
  baseVersionId: string
  headVersionId: string
  createdAt: Date
  createdBy?: string
  isActive: boolean
}

export interface MergeOptions {
  sourceBranchId: string
  targetBranchId: string
  strategy: 'fast-forward' | 'merge' | 'rebase'
  comment?: string
  createdBy?: string
  conflictResolution?: 'auto' | 'manual'
}

export interface ConflictResolution {
  conflictId: string
  resolution: 'keep-source' | 'keep-target' | 'merge' | 'custom'
  customValue?: any
}

export interface VersioningEvent {
  id: string
  type: 'create' | 'restore' | 'delete' | 'branch' | 'merge' | 'tag'
  fileId: string
  versionId?: string
  branchId?: string
  userId?: string
  timestamp: Date
  details: Record<string, any>
}
