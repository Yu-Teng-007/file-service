#!/bin/bash

# 文件管理系统前端部署脚本
# 使用方法: ./deploy.sh [环境] [版本]
# 示例: ./deploy.sh production v1.0.0

set -e

# 默认参数
ENVIRONMENT=${1:-production}
VERSION=${2:-latest}
IMAGE_NAME="file-manager-frontend"
CONTAINER_NAME="file-manager-frontend"
PORT=${PORT:-3000}

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    log_success "依赖检查完成"
}

# 构建镜像
build_image() {
    log_info "构建 Docker 镜像..."
    
    # 设置构建参数
    BUILD_ARGS=""
    if [ "$ENVIRONMENT" = "production" ]; then
        BUILD_ARGS="--build-arg NODE_ENV=production"
    fi
    
    # 构建镜像
    docker build $BUILD_ARGS -t $IMAGE_NAME:$VERSION -t $IMAGE_NAME:latest .
    
    if [ $? -eq 0 ]; then
        log_success "镜像构建完成: $IMAGE_NAME:$VERSION"
    else
        log_error "镜像构建失败"
        exit 1
    fi
}

# 停止旧容器
stop_old_container() {
    log_info "停止旧容器..."
    
    if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
        docker stop $CONTAINER_NAME
        docker rm $CONTAINER_NAME
        log_success "旧容器已停止并删除"
    else
        log_info "没有运行中的容器"
    fi
}

# 启动新容器
start_container() {
    log_info "启动新容器..."
    
    # 创建网络（如果不存在）
    docker network create file-manager-network 2>/dev/null || true
    
    # 启动容器
    docker run -d \
        --name $CONTAINER_NAME \
        --network file-manager-network \
        -p $PORT:80 \
        --restart unless-stopped \
        -e NODE_ENV=$ENVIRONMENT \
        $IMAGE_NAME:$VERSION
    
    if [ $? -eq 0 ]; then
        log_success "容器启动成功"
        log_info "应用访问地址: http://localhost:$PORT"
    else
        log_error "容器启动失败"
        exit 1
    fi
}

# 使用 Docker Compose 部署
deploy_with_compose() {
    log_info "使用 Docker Compose 部署..."
    
    # 设置环境变量
    export ENVIRONMENT=$ENVIRONMENT
    export VERSION=$VERSION
    
    # 停止旧服务
    docker-compose down
    
    # 启动新服务
    docker-compose up -d --build
    
    if [ $? -eq 0 ]; then
        log_success "Docker Compose 部署完成"
    else
        log_error "Docker Compose 部署失败"
        exit 1
    fi
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:$PORT/health >/dev/null 2>&1; then
            log_success "健康检查通过"
            return 0
        fi
        
        log_info "等待应用启动... ($attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    log_error "健康检查失败，应用可能未正常启动"
    return 1
}

# 清理旧镜像
cleanup() {
    log_info "清理旧镜像..."
    
    # 删除无标签的镜像
    docker image prune -f
    
    # 删除旧版本镜像（保留最新的3个版本）
    docker images $IMAGE_NAME --format "table {{.Tag}}\t{{.ID}}" | \
        grep -v "latest\|$VERSION" | \
        tail -n +4 | \
        awk '{print $2}' | \
        xargs -r docker rmi
    
    log_success "清理完成"
}

# 显示帮助信息
show_help() {
    echo "文件管理系统前端部署脚本"
    echo ""
    echo "使用方法:"
    echo "  $0 [环境] [版本] [选项]"
    echo ""
    echo "参数:"
    echo "  环境    部署环境 (development|production) [默认: production]"
    echo "  版本    镜像版本标签 [默认: latest]"
    echo ""
    echo "选项:"
    echo "  -h, --help     显示帮助信息"
    echo "  -c, --compose  使用 Docker Compose 部署"
    echo "  --no-build     跳过镜像构建"
    echo "  --no-health    跳过健康检查"
    echo "  --cleanup      部署后清理旧镜像"
    echo ""
    echo "示例:"
    echo "  $0 production v1.0.0"
    echo "  $0 development latest --compose"
    echo "  $0 production v1.0.0 --cleanup"
}

# 主函数
main() {
    local use_compose=false
    local skip_build=false
    local skip_health=false
    local do_cleanup=false
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -c|--compose)
                use_compose=true
                shift
                ;;
            --no-build)
                skip_build=true
                shift
                ;;
            --no-health)
                skip_health=true
                shift
                ;;
            --cleanup)
                do_cleanup=true
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    log_info "开始部署文件管理系统前端"
    log_info "环境: $ENVIRONMENT"
    log_info "版本: $VERSION"
    log_info "端口: $PORT"
    
    # 检查依赖
    check_dependencies
    
    if [ "$use_compose" = true ]; then
        # 使用 Docker Compose 部署
        deploy_with_compose
    else
        # 使用 Docker 部署
        if [ "$skip_build" = false ]; then
            build_image
        fi
        
        stop_old_container
        start_container
    fi
    
    # 健康检查
    if [ "$skip_health" = false ]; then
        health_check
    fi
    
    # 清理
    if [ "$do_cleanup" = true ]; then
        cleanup
    fi
    
    log_success "部署完成！"
    log_info "应用访问地址: http://localhost:$PORT"
}

# 执行主函数
main "$@"
