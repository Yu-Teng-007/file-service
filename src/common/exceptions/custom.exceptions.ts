import { HttpException, HttpStatus } from '@nestjs/common'

export interface CustomExceptionResponse {
  code: string
  message: string
  details?: any
}

/**
 * 文件相关异常基类
 */
export abstract class FileException extends HttpException {
  constructor(
    code: string,
    message: string,
    status: HttpStatus,
    details?: any
  ) {
    const response: CustomExceptionResponse = {
      code,
      message,
      details,
    }
    super(response, status)
  }
}

/**
 * 文件不存在异常
 */
export class FileNotFoundException extends FileException {
  constructor(fileName?: string, details?: any) {
    super(
      'FILE_NOT_FOUND',
      fileName ? `文件不存在: ${fileName}` : '文件不存在',
      HttpStatus.NOT_FOUND,
      details
    )
  }
}

/**
 * 文件已存在异常
 */
export class FileAlreadyExistsException extends FileException {
  constructor(fileName?: string, details?: any) {
    super(
      'FILE_ALREADY_EXISTS',
      fileName ? `文件已存在: ${fileName}` : '文件已存在',
      HttpStatus.CONFLICT,
      details
    )
  }
}

/**
 * 文件大小超限异常
 */
export class FileSizeExceededException extends FileException {
  constructor(maxSize: number, actualSize?: number, details?: any) {
    const message = actualSize
      ? `文件大小超出限制，最大允许 ${maxSize} 字节，实际 ${actualSize} 字节`
      : `文件大小超出限制，最大允许 ${maxSize} 字节`
    
    super(
      'FILE_SIZE_EXCEEDED',
      message,
      HttpStatus.BAD_REQUEST,
      { maxSize, actualSize, ...details }
    )
  }
}

/**
 * 不支持的文件类型异常
 */
export class UnsupportedFileTypeException extends FileException {
  constructor(fileType?: string, supportedTypes?: string[], details?: any) {
    const message = fileType
      ? `不支持的文件类型: ${fileType}`
      : '不支持的文件类型'
    
    super(
      'UNSUPPORTED_FILE_TYPE',
      message,
      HttpStatus.BAD_REQUEST,
      { fileType, supportedTypes, ...details }
    )
  }
}

/**
 * 文件验证失败异常
 */
export class FileValidationException extends FileException {
  constructor(validationErrors: string[], details?: any) {
    super(
      'FILE_VALIDATION_FAILED',
      `文件验证失败: ${validationErrors.join(', ')}`,
      HttpStatus.BAD_REQUEST,
      { validationErrors, ...details }
    )
  }
}

/**
 * 文件处理异常
 */
export class FileProcessingException extends FileException {
  constructor(operation: string, reason?: string, details?: any) {
    const message = reason
      ? `文件${operation}失败: ${reason}`
      : `文件${operation}失败`
    
    super(
      'FILE_PROCESSING_FAILED',
      message,
      HttpStatus.INTERNAL_SERVER_ERROR,
      { operation, reason, ...details }
    )
  }
}

/**
 * 存储空间不足异常
 */
export class InsufficientStorageException extends FileException {
  constructor(requiredSpace?: number, availableSpace?: number, details?: any) {
    const message = requiredSpace && availableSpace
      ? `存储空间不足，需要 ${requiredSpace} 字节，可用 ${availableSpace} 字节`
      : '存储空间不足'
    
    super(
      'INSUFFICIENT_STORAGE',
      message,
      HttpStatus.INSUFFICIENT_STORAGE,
      { requiredSpace, availableSpace, ...details }
    )
  }
}

/**
 * 权限不足异常
 */
export class InsufficientPermissionException extends FileException {
  constructor(operation: string, resource?: string, details?: any) {
    const message = resource
      ? `权限不足，无法对 ${resource} 执行 ${operation} 操作`
      : `权限不足，无法执行 ${operation} 操作`
    
    super(
      'INSUFFICIENT_PERMISSION',
      message,
      HttpStatus.FORBIDDEN,
      { operation, resource, ...details }
    )
  }
}

/**
 * 缓存相关异常基类
 */
export abstract class CacheException extends HttpException {
  constructor(
    code: string,
    message: string,
    status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    details?: any
  ) {
    const response: CustomExceptionResponse = {
      code,
      message,
      details,
    }
    super(response, status)
  }
}

/**
 * 缓存连接失败异常
 */
export class CacheConnectionException extends CacheException {
  constructor(details?: any) {
    super(
      'CACHE_CONNECTION_FAILED',
      '缓存服务连接失败',
      HttpStatus.SERVICE_UNAVAILABLE,
      details
    )
  }
}

/**
 * 缓存操作超时异常
 */
export class CacheTimeoutException extends CacheException {
  constructor(operation: string, timeout: number, details?: any) {
    super(
      'CACHE_TIMEOUT',
      `缓存${operation}操作超时 (${timeout}ms)`,
      HttpStatus.REQUEST_TIMEOUT,
      { operation, timeout, ...details }
    )
  }
}

/**
 * 外部服务异常基类
 */
export abstract class ExternalServiceException extends HttpException {
  constructor(
    code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_GATEWAY,
    details?: any
  ) {
    const response: CustomExceptionResponse = {
      code,
      message,
      details,
    }
    super(response, status)
  }
}

/**
 * CDN服务异常
 */
export class CDNServiceException extends ExternalServiceException {
  constructor(operation: string, reason?: string, details?: any) {
    const message = reason
      ? `CDN服务${operation}失败: ${reason}`
      : `CDN服务${operation}失败`
    
    super(
      'CDN_SERVICE_ERROR',
      message,
      HttpStatus.BAD_GATEWAY,
      { operation, reason, ...details }
    )
  }
}

/**
 * 图片处理异常
 */
export class ImageProcessingException extends FileException {
  constructor(operation: string, reason?: string, details?: any) {
    const message = reason
      ? `图片${operation}失败: ${reason}`
      : `图片${operation}失败`
    
    super(
      'IMAGE_PROCESSING_FAILED',
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { operation, reason, ...details }
    )
  }
}

/**
 * 配置错误异常
 */
export class ConfigurationException extends HttpException {
  constructor(configKey: string, reason?: string, details?: any) {
    const message = reason
      ? `配置错误 (${configKey}): ${reason}`
      : `配置错误: ${configKey}`
    
    const response: CustomExceptionResponse = {
      code: 'CONFIGURATION_ERROR',
      message,
      details: { configKey, reason, ...details },
    }
    
    super(response, HttpStatus.INTERNAL_SERVER_ERROR)
  }
}

/**
 * 业务逻辑异常
 */
export class BusinessLogicException extends HttpException {
  constructor(code: string, message: string, details?: any) {
    const response: CustomExceptionResponse = {
      code,
      message,
      details,
    }
    super(response, HttpStatus.BAD_REQUEST)
  }
}

/**
 * 资源限制异常
 */
export class ResourceLimitException extends HttpException {
  constructor(resource: string, limit: number, current: number, details?: any) {
    const response: CustomExceptionResponse = {
      code: 'RESOURCE_LIMIT_EXCEEDED',
      message: `${resource}超出限制，当前: ${current}，限制: ${limit}`,
      details: { resource, limit, current, ...details },
    }
    super(response, HttpStatus.TOO_MANY_REQUESTS)
  }
}
