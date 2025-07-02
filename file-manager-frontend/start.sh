#!/bin/bash

# 文件管理系统前端快速启动脚本

set -e

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 文件管理系统前端启动脚本${NC}"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️  Node.js 未安装，请先安装 Node.js (>= 16.0.0)${NC}"
    exit 1
fi

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}⚠️  npm 未安装，请先安装 npm${NC}"
    exit 1
fi

echo -e "${BLUE}📦 检查依赖...${NC}"

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📥 安装依赖...${NC}"
    npm install
else
    echo -e "${GREEN}✅ 依赖已安装${NC}"
fi

echo ""
echo -e "${BLUE}🔧 配置环境...${NC}"

# 检查环境配置文件
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}⚠️  未找到 .env.local 文件，创建默认配置...${NC}"
    cat > .env.local << EOF
# 本地开发环境配置
VITE_APP_TITLE=文件管理系统 - 开发环境
VITE_API_BASE_URL=http://localhost:3001
VITE_API_KEY=default-api-key
EOF
    echo -e "${GREEN}✅ 已创建 .env.local 文件${NC}"
fi

echo ""
echo -e "${BLUE}🌟 启动开发服务器...${NC}"
echo -e "${GREEN}📍 应用将在 http://localhost:3000 启动${NC}"
echo -e "${GREEN}📍 API 地址: http://localhost:3001${NC}"
echo ""
echo -e "${YELLOW}💡 提示: 请确保文件服务后端已启动并运行在 3001 端口${NC}"
echo ""

# 启动开发服务器
npm run dev
