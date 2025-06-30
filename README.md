# 文件服务

一个用于存储和管理静态资源的综合文件服务系统，支持图片、脚本、样式表、字体、文档等多种文件类型。

## 功能特性

### 核心功能

- 🚀 **多格式支持**: 图片、JS、CSS、字体、文档、音乐文件
- 🔒 **安全保障**: 文件类型验证、大小限制、病毒扫描
- 🎯 **访问控制**: 公开、私有和受保护的访问级别
- 📁 **自动分类**: 自动文件分类和组织
- 🌐 **API 优先**: 带有完整文档的 RESTful API
- 🐳 **Docker 就绪**: 容器化部署支持

### 高级功能

- ⚡ **Redis 缓存**: 文件元数据缓存、热点文件缓存、缓存失效策略
- ☁️ **CDN 集成**: 支持 AWS S3、阿里云 OSS、腾讯云 COS
- 🖼️ **图片处理**: 压缩、调整大小、格式转换、水印（基于 Sharp）
- 📦 **文件压缩**: 支持 gzip、deflate、ZIP 压缩包
- 📊 **监控分析**: 文件访问统计、性能监控、存储分析
- 📚 **版本控制**: 文件历史、版本回滚、差异比较
- 🔄 **同步备份**: 自动文件同步和备份机制
- 🔍 **管理功能**: 文件搜索、批量操作、元数据管理

## 快速开始

### 前置要求

- Node.js 18+
- npm 或 yarn

### 安装

1. 克隆仓库：

```bash
git clone <repository-url>
cd file-service
```

2. 安装依赖：

```bash
npm install
```

3. 配置环境：

```bash
cp .env.example .env
# 编辑 .env 文件进行配置
```

4. （可选）启动 Redis 缓存：

```bash
# 使用 Docker（推荐）
.\scripts\start-redis.ps1

# 测试 Redis 连接
.\scripts\test-redis.ps1

# 更新 .env 启用 Redis
# REDIS_HOST=localhost
```

5. 启动开发服务器：

```bash
npm run start:dev
```

服务将在 `http://localhost:3001` 上运行

### 可用端点

- **API 文档**: http://localhost:3001/api
- **健康检查**: http://localhost:3001/info
- **监控面板**: http://localhost:3001/api/monitoring/dashboard

## 配置

### 环境变量

`.env` 文件中的关键配置选项：

**基础配置：**

- `PORT`: 服务器端口（默认：3001）
- `UPLOAD_DIR`: 文件存储目录
- `MAX_FILE_SIZE`: 全局文件大小限制
- `JWT_SECRET`: JWT 签名密钥
- `CORS_ORIGINS`: 允许的 CORS 来源

**Redis 缓存配置：**

- `REDIS_HOST`: Redis 服务器主机（默认：localhost）
- `REDIS_PORT`: Redis 服务器端口（默认：6379）
- `REDIS_PASSWORD`: Redis 密码（可选）
- `REDIS_DB`: Redis 数据库编号（默认：0）
- `CACHE_TTL`: 缓存生存时间，秒（默认：3600）

**CDN 配置：**

- `CDN_PROVIDER`: CDN 提供商（local, aws, aliyun, tencent）
- `CDN_BUCKET`: CDN 存储桶名称
- `CDN_ACCESS_KEY_ID`: CDN 访问密钥
- `CDN_ACCESS_KEY_SECRET`: CDN 密钥
- `CDN_REGION`: CDN 区域

**图片处理：**

- `IMAGE_PROCESSING_ENABLED`: 启用图片处理（默认：true）
- `IMAGE_QUALITY_DEFAULT`: 默认图片质量（默认：80）
- `IMAGE_MAX_SIZE`: 最大图片大小（默认：50MB）

**监控：**

- `MONITORING_ACCESS_LOGGING`: 启用访问日志（默认：true）
- `MONITORING_PERFORMANCE`: 启用性能监控（默认：true）
- `MONITORING_LOG_RETENTION_DAYS`: 日志保留期（默认：30天）

### 文件类型配置

服务支持自动文件分类：

- **图片**: jpg, png, gif, webp, svg
- **脚本**: js, ts, json
- **样式**: css, scss, less
- **字体**: ttf, woff, woff2, eot
- **文档**: pdf, txt, doc, docx
- **音乐**: mp3, wav, flac, ogg

## API 文档

运行后，访问 `http://localhost:3001/api` 查看交互式 API 文档。

### 主要端点

#### 文件管理

- `POST /api/files/upload` - 上传文件
- `GET /api/files` - 列出文件
- `GET /api/files/:id` - 获取文件信息
- `DELETE /api/files/:id` - 删除文件
- `PUT /api/files/:id` - 更新文件元数据
- `GET /uploads/:category/:filename` - 访问文件

#### 图片处理

- `POST /api/image-processing/process` - 处理图片
- `POST /api/image-processing/thumbnails` - 生成缩略图
- `POST /api/image-processing/compress` - 压缩图片
- `GET /api/image-processing/info/:path` - 获取图片信息

#### 文件压缩

- `POST /api/compression/compress` - 压缩文件
- `POST /api/compression/archive` - 创建压缩包
- `POST /api/compression/extract` - 解压文件

#### 监控

- `GET /api/monitoring/storage/stats` - 存储统计
- `GET /api/monitoring/performance/metrics` - 性能指标
- `GET /api/monitoring/dashboard` - 监控面板

## 开发

### 脚本命令

- `npm run start:dev` - 带热重载的开发服务器
- `npm run build` - 构建生产版本
- `npm run start:prod` - 启动生产服务器
- `npm run test` - 运行测试
- `npm run lint` - 代码检查

### 项目结构

```
src/
├── config/          # 配置模块
├── modules/         # 功能模块
│   ├── files/       # 文件管理
│   ├── auth/        # 身份验证
│   └── storage/     # 存储提供商
├── common/          # 共享工具
├── types/           # 类型定义
└── main.ts          # 应用程序入口
```

## 部署

### Docker

```bash
docker build -t file-service .
docker run -p 3001:3001 file-service
```

### 生产环境

1. 构建应用程序：

```bash
npm run build
```

2. 使用 PM2 启动：

```bash
pm2 start dist/main.js --name file-service
```

## 安全

- 文件类型验证
- 按类别限制大小
- 基于 JWT 的身份验证
- 速率限制
- CORS 保护
- 可选病毒扫描

## 许可证

MIT 许可证 - 详见 LICENSE 文件。
