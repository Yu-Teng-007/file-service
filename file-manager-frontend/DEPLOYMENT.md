# 部署指南

本文档详细说明了文件管理系统前端的各种部署方式。

## 快速开始

### 开发环境

1. **克隆项目**
```bash
git clone <repository-url>
cd file-manager-frontend
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
cp .env.development .env.local
# 编辑 .env.local 文件，配置 API 地址和密钥
```

4. **启动开发服务器**
```bash
npm run dev
# 或使用快速启动脚本
chmod +x start.sh
./start.sh
```

访问 http://localhost:3000

## 生产环境部署

### 方式一：Docker 部署（推荐）

#### 单容器部署

1. **构建镜像**
```bash
docker build -t file-manager-frontend .
```

2. **运行容器**
```bash
docker run -d \
  --name file-manager-frontend \
  -p 3000:80 \
  --restart unless-stopped \
  file-manager-frontend
```

#### 使用部署脚本

```bash
# 赋予执行权限
chmod +x deploy.sh

# 部署到生产环境
./deploy.sh production v1.0.0

# 使用 Docker Compose 部署
./deploy.sh production v1.0.0 --compose

# 部署后清理旧镜像
./deploy.sh production v1.0.0 --cleanup
```

### 方式二：Docker Compose 部署

1. **配置环境变量**
```bash
# 创建 .env 文件
cat > .env << EOF
ENVIRONMENT=production
VERSION=latest
API_KEY=your-production-api-key
EOF
```

2. **启动服务**
```bash
docker-compose up -d
```

3. **查看服务状态**
```bash
docker-compose ps
docker-compose logs -f file-manager-frontend
```

### 方式三：传统部署

#### 构建静态文件

```bash
# 安装依赖
npm install

# 构建生产版本
npm run build
```

#### Nginx 配置

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api/ {
        proxy_pass http://your-backend-server:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

#### Apache 配置

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /path/to/dist
    
    # SPA 路由支持
    <Directory "/path/to/dist">
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
    
    # 静态资源缓存
    <LocationMatch "\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$">
        ExpiresActive On
        ExpiresDefault "access plus 1 year"
    </LocationMatch>
</VirtualHost>
```

## 环境配置

### 环境变量说明

| 变量名 | 说明 | 默认值 | 必需 |
|--------|------|--------|------|
| `VITE_API_BASE_URL` | 后端 API 地址 | `http://localhost:3001` | 是 |
| `VITE_API_KEY` | API 密钥 | `default-api-key` | 是 |
| `VITE_APP_TITLE` | 应用标题 | `文件管理系统` | 否 |

### 配置文件

- `.env` - 默认配置
- `.env.local` - 本地配置（不提交到版本控制）
- `.env.development` - 开发环境配置
- `.env.production` - 生产环境配置

## 性能优化

### 构建优化

1. **代码分割**
   - 自动按路由分割代码
   - 第三方库单独打包

2. **资源压缩**
   - JavaScript/CSS 压缩
   - 图片优化

3. **缓存策略**
   - 静态资源长期缓存
   - HTML 文件不缓存

### 运行时优化

1. **CDN 配置**
```bash
# 配置 CDN 地址
VITE_CDN_URL=https://your-cdn.com
```

2. **Gzip 压缩**
   - Nginx/Apache 启用 Gzip
   - 压缩 JavaScript/CSS/HTML

3. **HTTP/2**
   - 启用 HTTP/2 协议
   - 多路复用提升性能

## 监控和日志

### 应用监控

1. **健康检查**
```bash
curl http://localhost:3000/health
```

2. **性能监控**
   - 使用 Web Vitals 监控
   - 集成 Google Analytics

### 日志管理

1. **Nginx 日志**
```nginx
access_log /var/log/nginx/file-manager-access.log;
error_log /var/log/nginx/file-manager-error.log;
```

2. **Docker 日志**
```bash
# 查看容器日志
docker logs file-manager-frontend

# 实时查看日志
docker logs -f file-manager-frontend
```

## 安全配置

### HTTPS 配置

1. **SSL 证书**
```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
}
```

2. **安全头部**
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### 访问控制

1. **IP 白名单**
```nginx
location /admin {
    allow 192.168.1.0/24;
    deny all;
}
```

2. **基础认证**
```nginx
location /admin {
    auth_basic "Admin Area";
    auth_basic_user_file /etc/nginx/.htpasswd;
}
```

## 故障排除

### 常见问题

1. **API 连接失败**
   - 检查 API 地址配置
   - 确认后端服务状态
   - 检查网络连接

2. **静态资源加载失败**
   - 检查 Nginx 配置
   - 确认文件路径正确
   - 检查文件权限

3. **路由不工作**
   - 确认 SPA 路由配置
   - 检查 `try_files` 设置

### 调试方法

1. **开发者工具**
   - 检查网络请求
   - 查看控制台错误

2. **服务器日志**
   - 查看 Nginx 错误日志
   - 检查应用日志

3. **健康检查**
   - 使用健康检查端点
   - 监控服务状态

## 备份和恢复

### 配置备份

```bash
# 备份配置文件
tar -czf config-backup-$(date +%Y%m%d).tar.gz \
  .env* nginx.conf docker-compose.yml
```

### 数据恢复

```bash
# 恢复配置
tar -xzf config-backup-20231201.tar.gz

# 重新部署
./deploy.sh production latest
```

## 版本升级

### 升级步骤

1. **备份当前版本**
```bash
docker tag file-manager-frontend:latest file-manager-frontend:backup
```

2. **部署新版本**
```bash
./deploy.sh production v2.0.0
```

3. **验证升级**
```bash
curl http://localhost:3000/health
```

4. **回滚（如需要）**
```bash
docker tag file-manager-frontend:backup file-manager-frontend:latest
docker restart file-manager-frontend
```

## 支持和维护

如有问题，请：

1. 查看本文档的故障排除部分
2. 检查项目 Issues
3. 联系技术支持团队

---

更多详细信息请参考项目 README.md 文件。
