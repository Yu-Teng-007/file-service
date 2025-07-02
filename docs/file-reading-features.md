# 磁盘文件读取功能文档

## 概述

文件服务系统现已支持强大的磁盘文件读取功能，允许您直接从磁盘读取已上传文件的内容。这个功能提供了多种读取模式、缓存机制和性能优化。

## 新增功能

### 1. 文件内容读取模式

- **完整读取 (FULL)**: 将整个文件读取到内存中
- **部分读取 (PARTIAL)**: 读取文件的指定部分
- **分块读取 (CHUNK)**: 以流的方式分块读取大文件
- **流式读取 (STREAM)**: 传统的流式读取（已存在）

### 2. 支持的编码格式

- **Buffer**: 返回原始二进制数据
- **UTF-8**: 文本文件的默认编码
- **ASCII**: ASCII编码
- **其他**: 支持所有Node.js BufferEncoding类型

### 3. 缓存机制

- **内存缓存**: 自动缓存小文件内容（<10MB）
- **TTL控制**: 可配置缓存过期时间
- **缓存键**: 支持自定义缓存键
- **自动清理**: 定期清理过期缓存

### 4. 性能优化

- **路径验证**: 安全的文件路径验证
- **大小限制**: 可配置的最大读取大小
- **统计信息**: 详细的读取性能统计
- **错误处理**: 完善的错误处理和恢复

## API 端点

### 1. 读取文件内容

```http
GET /api/files/:id/content
```

**查询参数:**
- `mode`: 读取模式 (`full`, `partial`)
- `encoding`: 编码格式 (`utf8`, `buffer`, 等)
- `start`: 起始位置（字节，仅部分读取）
- `end`: 结束位置（字节，仅部分读取）
- `maxSize`: 最大读取大小（字节）

**响应示例:**
```json
{
  "success": true,
  "message": "文件内容读取成功",
  "data": {
    "content": "Hello, World!",
    "size": 13,
    "mimeType": "text/plain",
    "encoding": "utf8",
    "fromCache": false,
    "readTime": 5
  }
}
```

### 2. 读取文本文件

```http
GET /api/files/:id/text?encoding=utf8
```

**响应示例:**
```json
{
  "success": true,
  "message": "文本内容读取成功",
  "data": "Hello, World!\nThis is a text file."
}
```

### 3. 读取JSON文件

```http
GET /api/files/:id/json
```

**响应示例:**
```json
{
  "success": true,
  "message": "JSON内容读取成功",
  "data": {
    "name": "example",
    "value": 123
  }
}
```

### 4. 获取读取统计

```http
GET /api/files/stats/read
```

**响应示例:**
```json
{
  "success": true,
  "message": "统计信息获取成功",
  "data": {
    "totalReads": 150,
    "cacheHits": 45,
    "cacheMisses": 105,
    "averageReadTime": 12.5,
    "totalBytesRead": 1048576
  }
}
```

### 5. 清空内容缓存

```http
DELETE /api/files/cache/content
```

## 使用示例

### JavaScript/Node.js

```javascript
const axios = require('axios')

// 读取完整文件内容
const response = await axios.get('/api/files/file-id/content', {
  params: { mode: 'full', encoding: 'utf8' }
})

console.log('文件内容:', response.data.data.content)
console.log('是否来自缓存:', response.data.data.fromCache)

// 读取部分内容
const partialResponse = await axios.get('/api/files/file-id/content', {
  params: { 
    mode: 'partial', 
    encoding: 'utf8', 
    start: 0, 
    end: 100 
  }
})

// 读取JSON文件
const jsonResponse = await axios.get('/api/files/file-id/json')
const data = jsonResponse.data.data
```

### cURL

```bash
# 读取文件内容
curl "http://localhost:3001/api/files/file-id/content?mode=full&encoding=utf8"

# 读取部分内容
curl "http://localhost:3001/api/files/file-id/content?mode=partial&start=0&end=100"

# 读取文本文件
curl "http://localhost:3001/api/files/file-id/text"

# 读取JSON文件
curl "http://localhost:3001/api/files/file-id/json"

# 获取统计信息
curl "http://localhost:3001/api/files/stats/read"

# 清空缓存
curl -X DELETE "http://localhost:3001/api/files/cache/content"
```

## 配置选项

### 环境变量

```bash
# 最大文件读取大小（字节）
MAX_FILE_READ_SIZE=104857600  # 100MB

# 缓存TTL（秒）
FILE_CACHE_TTL=300  # 5分钟

# 缓存清理间隔（毫秒）
CACHE_CLEANUP_INTERVAL=300000  # 5分钟
```

### 代码配置

```typescript
// 文件读取选项
const options: FileReadOptions = {
  mode: FileReadMode.FULL,
  encoding: 'utf8',
  maxSize: 10 * 1024 * 1024,  // 10MB
  useCache: true,
  cacheTTL: 600,  // 10分钟
}

// 读取文件
const result = await filesService.readFileContent(fileId, options)
```

## 安全考虑

### 路径验证
- 自动验证文件路径在允许的目录范围内
- 防止路径遍历攻击（`../`, `~`等）
- 检查路径长度限制

### 访问控制
- 继承原有的文件访问级别控制
- 支持公开、私有和受保护的访问级别

### 大小限制
- 可配置的最大读取大小
- 防止内存溢出攻击
- 自动拒绝超大文件读取

## 性能建议

### 缓存策略
- 小文件（<10MB）自动缓存
- 大文件建议使用流式读取
- 定期清理过期缓存

### 读取模式选择
- **小文件**: 使用完整读取模式
- **大文件**: 使用分块或流式读取
- **部分内容**: 使用部分读取模式

### 监控和调优
- 定期检查读取统计信息
- 根据缓存命中率调整TTL
- 监控内存使用情况

## 错误处理

### 常见错误

| 错误代码 | 描述 | 解决方案 |
|---------|------|----------|
| 404 | 文件不存在 | 检查文件ID是否正确 |
| 400 | 参数错误 | 检查查询参数格式 |
| 413 | 文件过大 | 减小读取范围或使用流式读取 |
| 500 | 服务器错误 | 检查服务器日志 |

### 错误响应示例

```json
{
  "success": false,
  "message": "文件不存在",
  "error": "FileNotFoundException",
  "statusCode": 404
}
```

## 测试

运行演示脚本来测试新功能：

```bash
node demo-file-reading.js
```

运行单元测试：

```bash
npm test -- --testPathPattern=file-storage.service.spec.ts
npm test -- --testPathPattern=files.service.spec.ts
```

运行集成测试：

```bash
npm run test:e2e
```

## 更新日志

### v1.1.0 - 磁盘文件读取功能
- ✅ 新增完整文件内容读取
- ✅ 新增部分文件内容读取
- ✅ 新增分块读取支持
- ✅ 新增内存缓存机制
- ✅ 新增读取统计功能
- ✅ 新增安全路径验证
- ✅ 新增文本和JSON读取API
- ✅ 新增缓存管理API
- ✅ 完善错误处理机制
- ✅ 添加性能优化
- ✅ 增加单元测试和集成测试
