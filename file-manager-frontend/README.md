# 文件管理系统前端

一个现代化的文件管理系统前端应用，基于 Vue 3 + TypeScript + Element Plus 构建，用于管控文件的上传、删除、预览等操作。

## 功能特性

### 🚀 核心功能
- **文件上传**：支持拖拽上传、批量上传、进度显示
- **文件管理**：文件列表、搜索、筛选、分页
- **文件操作**：预览、下载、重命名、删除、批量操作
- **文件分类**：自动分类识别，支持图片、文档、音频、视频等
- **访问控制**：支持公开、私有、受保护三种访问级别

### 🎨 用户体验
- **响应式设计**：适配桌面端和移动端
- **主题切换**：支持浅色、深色、跟随系统主题
- **国际化**：支持中文简体和英文
- **实时反馈**：操作状态提示、进度显示

### ⚙️ 系统管理
- **API配置**：灵活配置后端API地址和密钥
- **上传设置**：自定义文件大小限制和类型限制
- **系统监控**：磁盘使用情况、文件统计
- **缓存管理**：支持清除缓存和重置设置

## 技术栈

- **框架**：Vue 3 + TypeScript
- **构建工具**：Vite
- **UI组件库**：Element Plus
- **状态管理**：Pinia
- **路由**：Vue Router
- **HTTP客户端**：Axios
- **国际化**：Vue I18n
- **时间处理**：Day.js

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0 或 yarn >= 1.22.0

### 安装依赖

```bash
# 使用 npm
npm install

# 或使用 yarn
yarn install
```

### 开发环境

```bash
# 启动开发服务器
npm run dev

# 或
yarn dev
```

访问 http://localhost:3000

### 生产构建

```bash
# 构建生产版本
npm run build

# 或
yarn build
```

### 预览生产版本

```bash
# 预览构建结果
npm run preview

# 或
yarn preview
```

## 配置说明

### 环境变量

创建 `.env.local` 文件来配置本地环境：

```bash
# API配置
VITE_API_BASE_URL=http://localhost:3001
VITE_API_KEY=your-api-key

# 应用配置
VITE_APP_TITLE=文件管理系统
```

### API配置

在应用的设置页面中可以动态配置：

- **API地址**：后端文件服务的地址
- **API密钥**：用于身份验证的密钥
- **上传限制**：文件大小和类型限制

## 项目结构

```
src/
├── api/                 # API接口
│   ├── client.ts       # HTTP客户端
│   └── files.ts        # 文件相关API
├── components/         # 公共组件
│   ├── FileUpload.vue  # 文件上传组件
│   ├── FilePropertiesDialog.vue  # 文件属性对话框
│   └── RenameDialog.vue # 重命名对话框
├── layouts/            # 布局组件
│   └── MainLayout.vue  # 主布局
├── locales/            # 国际化文件
│   ├── zh-CN.json      # 中文
│   └── en-US.json      # 英文
├── router/             # 路由配置
│   └── index.ts
├── stores/             # 状态管理
│   ├── config.ts       # 配置状态
│   └── files.ts        # 文件状态
├── types/              # 类型定义
│   ├── file.ts         # 文件相关类型
│   └── config.ts       # 配置相关类型
├── views/              # 页面组件
│   ├── Dashboard.vue   # 仪表板
│   ├── FileList.vue    # 文件列表
│   ├── Upload.vue      # 文件上传
│   ├── Settings.vue    # 系统设置
│   └── NotFound.vue    # 404页面
├── App.vue             # 根组件
└── main.ts             # 入口文件
```

## 部署指南

### Docker 部署

```bash
# 构建镜像
docker build -t file-manager-frontend .

# 运行容器
docker run -d -p 3000:80 --name file-manager-frontend file-manager-frontend
```

### Nginx 部署

1. 构建生产版本：
```bash
npm run build
```

2. 将 `dist` 目录内容部署到 Nginx：
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API代理（可选）
    location /api/ {
        proxy_pass http://your-backend-server:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 开发指南

### 代码规范

项目使用 ESLint 和 Prettier 进行代码规范检查：

```bash
# 检查代码规范
npm run lint

# 格式化代码
npm run format

# 类型检查
npm run type-check
```

### 组件开发

- 使用 Vue 3 Composition API
- 组件采用 `<script setup>` 语法
- 使用 TypeScript 进行类型约束
- 遵循 Element Plus 设计规范

### 状态管理

使用 Pinia 进行状态管理：

```typescript
// 定义 store
export const useExampleStore = defineStore('example', () => {
  const state = ref(initialState)
  
  const getters = computed(() => {
    // 计算属性
  })
  
  const actions = {
    // 方法
  }
  
  return { state, getters, ...actions }
})
```

## 常见问题

### Q: 如何配置后端API地址？
A: 在设置页面的"API配置"部分修改API地址和密钥，或者在环境变量中配置。

### Q: 支持哪些文件类型？
A: 支持图片、文档、音频、视频、压缩包等常见文件类型，可在设置中自定义。

### Q: 如何自定义主题？
A: 在设置页面选择主题模式，或修改 CSS 变量来自定义样式。

### Q: 如何添加新的语言？
A: 在 `src/locales/` 目录下添加新的语言文件，并在配置中注册。

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 Issue
- 发送邮件
- 项目讨论区

---

**注意**：本前端应用需要配合对应的文件服务后端使用。请确保后端服务正常运行并正确配置API地址。
