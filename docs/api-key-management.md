# API Key 管理指南

本文档介绍如何管理文件服务系统的 API Key，包括生成、更新和安全最佳实践。

## 概述

文件服务系统使用 API Key 进行身份验证，确保只有授权的客户端可以访问 API。每个环境都有独立的 API Key：

- **开发环境** (`dev`): 用于本地开发和测试
- **测试环境** (`test`): 用于自动化测试和集成测试
- **生产环境** (`prod`): 用于生产部署

## 当前 API Keys

### 开发环境
```
API_KEY=dev_fs_2025_7b8c9d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e
```

### 测试环境
```
API_KEY=test_fs_2025_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b
```

### 生产环境
```
API_KEY=prod_fs_2025_9f8e7d6c5b4a3928374658291047382910473829104738291047382910473829
```

## 生成新的 API Keys

### 使用 Node.js 脚本

```bash
# 生成所有环境的 API Keys
npm run keys:generate

# 生成特定环境的 API Key
npm run keys:generate:dev
npm run keys:generate:test
npm run keys:generate:prod
```

### 使用 PowerShell 脚本

```powershell
# 生成所有环境的 API Keys
.\scripts\generate-api-keys.ps1

# 生成特定环境的 API Key
.\scripts\generate-api-keys.ps1 -Environment dev
.\scripts\generate-api-keys.ps1 -Environment test
.\scripts\generate-api-keys.ps1 -Environment prod

# 自定义密钥长度
.\scripts\generate-api-keys.ps1 -KeyLength 64
```

## API Key 格式

API Key 采用以下格式：
```
{environment}_fs_{year}_{random_hex}
```

- `environment`: 环境名称 (dev, test, prod)
- `fs`: 文件服务标识符
- `year`: 生成年份
- `random_hex`: 随机十六进制字符串

## 环境配置文件

### 后端配置文件

- `.env.development` - 开发环境配置
- `.env.test` - 测试环境配置
- `.env.production` - 生产环境配置

### 前端配置文件

- `file-manager-frontend/.env.development` - 前端开发环境配置
- `file-manager-frontend/.env.test` - 前端测试环境配置
- `file-manager-frontend/.env.production` - 前端生产环境配置

## 使用 API Key

### 在 HTTP 请求中使用

```bash
curl -X GET "http://localhost:3001/api/files" \
  -H "Accept: application/json" \
  -H "X-API-Key: your-api-key-here"
```

### 在前端应用中使用

API Key 会自动从环境变量中读取并添加到请求头中：

```typescript
// 自动添加 X-API-Key 头部
const response = await apiClient.get('/files')
```

## 安全最佳实践

### 1. 定期轮换 API Keys

建议每 3-6 个月轮换一次 API Key，特别是生产环境：

```bash
# 生成新的生产环境 API Key
npm run keys:generate:prod
```

### 2. 环境隔离

- 不同环境使用不同的 API Key
- 开发环境的 API Key 不应在生产环境中使用
- 测试环境的 API Key 应定期更新

### 3. 密钥存储

- **开发环境**: 可以存储在 `.env.development` 文件中
- **生产环境**: 应使用环境变量或密钥管理服务
- **永远不要**: 将生产环境的 API Key 提交到版本控制系统

### 4. 访问控制

- 限制 API Key 的使用范围
- 监控 API Key 的使用情况
- 及时撤销泄露的 API Key

## 部署注意事项

### 开发环境

```bash
# 使用开发环境配置
npm run env:dev
npm run start:dev
```

### 生产环境

```bash
# 设置生产环境变量
export API_KEY="your-production-api-key"
export JWT_SECRET="your-production-jwt-secret"

# 或使用生产环境配置文件
npm run env:prod
npm run start:prod
```

### Docker 部署

```dockerfile
# 在 Dockerfile 中设置环境变量
ENV API_KEY=your-production-api-key
ENV JWT_SECRET=your-production-jwt-secret
```

或使用 docker-compose.yml：

```yaml
environment:
  - API_KEY=your-production-api-key
  - JWT_SECRET=your-production-jwt-secret
```

## 故障排除

### API Key 验证失败

1. 检查 API Key 是否正确设置在环境变量中
2. 确认请求头中包含 `X-API-Key`
3. 验证 API Key 格式是否正确

### 环境配置问题

1. 确认使用了正确的环境配置文件
2. 检查环境变量是否正确加载
3. 验证前后端使用的是相同的 API Key

## 监控和日志

系统会记录以下 API Key 相关的事件：

- API Key 验证成功/失败
- 无效的 API Key 尝试
- API Key 使用统计

查看日志：

```bash
# 查看 API Key 验证日志
grep "API Key" logs/application.log

# 查看失败的验证尝试
grep "API Key 验证失败" logs/application.log
```

## 联系支持

如果遇到 API Key 相关问题，请联系系统管理员或查看系统日志获取更多信息。
