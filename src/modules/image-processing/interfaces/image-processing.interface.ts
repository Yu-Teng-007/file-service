export interface ResizeOptions {
  width?: number
  height?: number
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
  position?: 'top' | 'right top' | 'right' | 'right bottom' | 'bottom' | 'left bottom' | 'left' | 'left top' | 'center'
  background?: string
  withoutEnlargement?: boolean
  withoutReduction?: boolean
}

export interface CompressOptions {
  quality?: number // 1-100
  progressive?: boolean
  mozjpeg?: boolean
  optimizeScans?: boolean
  optimizeCoding?: boolean
  quantizationTable?: number
}

export interface WatermarkOptions {
  text?: string
  image?: string
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
  opacity?: number // 0-1
  fontSize?: number
  fontColor?: string
  fontFamily?: string
  margin?: number
}

export interface CropOptions {
  left: number
  top: number
  width: number
  height: number
}

export interface RotateOptions {
  angle: number
  background?: string
}

export interface FormatOptions {
  format: 'jpeg' | 'png' | 'webp' | 'avif' | 'tiff' | 'gif'
  quality?: number
  progressive?: boolean
  lossless?: boolean
  effort?: number // 0-6 for webp
}

export interface FilterOptions {
  blur?: number
  sharpen?: number
  brightness?: number // -1 to 1
  contrast?: number // -1 to 1
  saturation?: number // -1 to 1
  hue?: number // 0-360
  gamma?: number
  negate?: boolean
  grayscale?: boolean
  sepia?: boolean
}

export interface ImageProcessingOptions {
  resize?: ResizeOptions
  compress?: CompressOptions
  watermark?: WatermarkOptions
  crop?: CropOptions
  rotate?: RotateOptions
  format?: FormatOptions
  filter?: FilterOptions
  stripMetadata?: boolean
}

export interface ImageInfo {
  width: number
  height: number
  format: string
  size: number
  density?: number
  hasAlpha?: boolean
  channels: number
  colorspace: string
}

export interface ProcessingResult {
  buffer: Buffer
  info: ImageInfo
  originalSize: number
  processedSize: number
  compressionRatio: number
}

export interface ThumbnailOptions {
  sizes: Array<{
    name: string
    width: number
    height?: number
    quality?: number
  }>
  format?: 'jpeg' | 'png' | 'webp'
  progressive?: boolean
}

export interface ThumbnailResult {
  thumbnails: Array<{
    name: string
    buffer: Buffer
    width: number
    height: number
    size: number
  }>
}
