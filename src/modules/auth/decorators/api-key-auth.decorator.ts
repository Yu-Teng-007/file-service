import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common'
import { ApiSecurity } from '@nestjs/swagger'
import { ApiKeyGuard } from '../guards/api-key.guard'

export const API_KEY_AUTH_METADATA = 'api-key-auth'

/**
 * API Key 身份验证装饰器
 * 
 * 使用此装饰器的路由将需要在请求头中提供有效的 X-API-Key
 * 
 * @example
 * ```typescript
 * @Post('upload')
 * @ApiKeyAuth()
 * async uploadFile() {
 *   // 此方法需要 API Key 验证
 * }
 * ```
 */
export const ApiKeyAuth = () => {
  return applyDecorators(
    SetMetadata(API_KEY_AUTH_METADATA, true),
    UseGuards(ApiKeyGuard),
    ApiSecurity('API-Key'),
  )
}

/**
 * 可选的 API Key 身份验证装饰器
 * 
 * 使用此装饰器的路由将检查 API Key，但不会强制要求
 * 主要用于提供额外的权限或功能
 */
export const OptionalApiKeyAuth = () => {
  return applyDecorators(
    SetMetadata(API_KEY_AUTH_METADATA, false),
    ApiSecurity('API-Key'),
  )
}
