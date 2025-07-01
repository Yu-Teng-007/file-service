# 环境配置指南

本文档说明如何为不同环境配置文件服务。

## 配置文件优先级

配置文件按以下优先级加载（后加载的会覆盖先加载的）：

1. `.env` - 基础配置文件
2. `.env.local` - 本地覆盖配置（不应提交到版本控制）
3. `.env.${NODE_ENV}` - 环境特定配置文件

## 环境配置文件

### 开发环境 (`.env.development`)

用于本地开发，特点：
- 详细的调试日志
- 宽松的安全设置
- 本地存储
- 启用 Swagger 文档
- 较大的文件大小限制

### 生产环境 (`.env.production`)

用于生产部署，特点：
- 严格的安全设置
- 云存储集成
- 完整的监控
- 禁用调试功能
- 强制 HTTPS

### 测试环境 (`.env.test`)

用于自动化测试，特点：
- 内存数据库
- 最小化日志
- 禁用外部服务
- 快速清理
- 模拟服务

## 环境变量说明

### 必需的生产环境变量

以下变量在生产环境中必须设置：

```bash
JWT_SECRET=your-strong-jwt-secret
API_KEY=your-api-key
CORS_ORIGINS=https://yourdomain.com
```

### 可选的云服务配置

#### AWS S3
```bash
STORAGE_PROVIDER=aws
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket
```

#### 阿里云 OSS
```bash
STORAGE_PROVIDER=aliyun
ALIYUN_ACCESS_KEY_ID=your-access-key
ALIYUN_ACCESS_KEY_SECRET=your-secret-key
ALIYUN_OSS_REGION=oss-cn-hangzhou
ALIYUN_OSS_BUCKET=your-bucket
```

#### Redis 缓存
```bash
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0
```

## 使用方法

### 1. 设置环境

```bash
# 开发环境
export NODE_ENV=development

# 生产环境
export NODE_ENV=production

# 测试环境
export NODE_ENV=test
```

### 2. 启动应用

```bash
# 开发环境
npm run start:dev

# 生产环境
npm run start:prod

# 测试环境
npm run test
```

### 3. Docker 部署

```bash
# 使用环境文件
docker run --env-file .env.production your-app

# 或者直接设置环境变量
docker run -e NODE_ENV=production -e JWT_SECRET=your-secret your-app
```

## 配置验证

应用启动时会自动验证配置：

- 检查必需的环境变量
- 验证数据类型和范围
- 确保生产环境安全设置

如果配置验证失败，应用将拒绝启动并显示错误信息。

## 最佳实践

### 1. 安全性
- 生产环境密钥不要硬编码
- 使用环境变量或密钥管理服务
- 定期轮换密钥

### 2. 配置管理
- 使用 `.env.local` 进行本地覆盖
- 不要将敏感信息提交到版本控制
- 为不同环境维护单独的配置

### 3. 监控
- 启用生产环境监控
- 设置适当的日志级别
- 配置健康检查

## 故障排除

### 常见问题

1. **配置验证失败**
   - 检查必需的环境变量是否设置
   - 验证数据类型和格式

2. **Redis 连接失败**
   - 检查 Redis 服务是否运行
   - 验证连接参数

3. **文件上传失败**
   - 检查存储目录权限
   - 验证文件大小限制

### 调试技巧

```bash
# 查看当前配置
npm run start:dev -- --debug-config

# 验证环境变量
node -e "console.log(process.env)"

# 测试配置加载
npm run test:config
```

## 示例配置

### 开发环境示例
```bash
NODE_ENV=development
PORT=3001
DEBUG=true
ENABLE_SWAGGER=true
LOG_LEVEL=debug
```

### 生产环境示例
```bash
NODE_ENV=production
PORT=3001
JWT_SECRET=your-production-secret
CORS_ORIGINS=https://yourdomain.com
STORAGE_PROVIDER=aws
ENABLE_SWAGGER=false
LOG_LEVEL=info
```
