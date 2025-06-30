export interface SyncConfig {
  id: string
  name: string
  description?: string
  sourceType: 'local' | 'cdn' | 'remote'
  targetType: 'local' | 'cdn' | 'remote'
  sourceConfig: any
  targetConfig: any
  syncMode: 'one-way' | 'two-way'
  schedule: string // cron expression
  enabled: boolean
  lastSync?: Date
  nextSync?: Date
}

export interface BackupConfig {
  id: string
  name: string
  description?: string
  sourcePattern: string
  targetLocation: string
  schedule: string // cron expression
  retention: {
    days: number
    maxBackups: number
  }
  compression: boolean
  encryption: boolean
  enabled: boolean
  lastBackup?: Date
  nextBackup?: Date
}

export interface SyncResult {
  id: string
  configId: string
  startTime: Date
  endTime: Date
  status: 'success' | 'failed' | 'partial'
  filesProcessed: number
  filesAdded: number
  filesUpdated: number
  filesDeleted: number
  bytesTransferred: number
  errors: Array<{
    file: string
    error: string
  }>
}

export interface BackupResult {
  id: string
  configId: string
  startTime: Date
  endTime: Date
  status: 'success' | 'failed'
  filesBackedUp: number
  totalSize: number
  backupLocation: string
  errors: Array<{
    file: string
    error: string
  }>
}

export interface RestoreOptions {
  backupId: string
  targetLocation: string
  overwrite: boolean
  preservePermissions: boolean
  filter?: (file: string) => boolean
}
