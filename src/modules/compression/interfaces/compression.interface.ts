export interface CompressionOptions {
  level?: number // 压缩级别 0-9
  method?: 'gzip' | 'deflate' | 'brotli'
  chunkSize?: number
  windowBits?: number
  memLevel?: number
  strategy?: number
}

export interface ArchiveOptions {
  format: 'zip' | 'tar' | 'tar.gz' | 'tar.bz2'
  compression?: CompressionOptions
  password?: string
  comment?: string
}

export interface ArchiveEntry {
  name: string
  path: string
  isDirectory?: boolean
  size?: number
  date?: Date
}

export interface ExtractionOptions {
  destination: string
  password?: string
  overwrite?: boolean
  preservePaths?: boolean
  filter?: (entry: ArchiveEntry) => boolean
}

export interface CompressionResult {
  originalSize: number
  compressedSize: number
  compressionRatio: number
  outputPath: string
  format: string
  method?: string
}

export interface ArchiveResult {
  archivePath: string
  entries: ArchiveEntry[]
  totalSize: number
  compressedSize: number
  compressionRatio: number
  format: string
}

export interface ExtractionResult {
  extractedFiles: ArchiveEntry[]
  totalFiles: number
  totalSize: number
  destination: string
}

export interface ArchiveInfo {
  format: string
  entries: ArchiveEntry[]
  totalFiles: number
  totalSize: number
  compressedSize: number
  compressionRatio: number
  hasPassword: boolean
  comment?: string
  created?: Date
}

export interface StreamCompressionOptions extends CompressionOptions {
  inputStream: NodeJS.ReadableStream
  outputStream: NodeJS.WritableStream
}

export interface ProgressCallback {
  (progress: {
    processed: number
    total: number
    percentage: number
    currentFile?: string
  }): void
}
