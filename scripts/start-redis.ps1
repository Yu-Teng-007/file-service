# Redis启动脚本
# 使用Docker启动Redis服务

Write-Host "启动Redis服务..." -ForegroundColor Green

# 检查Docker是否安装
try {
    docker --version | Out-Null
    Write-Host "Docker已安装" -ForegroundColor Green
} catch {
    Write-Host "错误: Docker未安装或未启动" -ForegroundColor Red
    Write-Host "请安装Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# 停止现有的Redis容器（如果存在）
Write-Host "停止现有Redis容器..." -ForegroundColor Yellow
docker stop file-service-redis 2>$null
docker rm file-service-redis 2>$null

# 启动新的Redis容器
Write-Host "启动Redis容器..." -ForegroundColor Green
docker run -d `
    --name file-service-redis `
    -p 6379:6379 `
    redis:7-alpine `
    redis-server --appendonly yes

if ($LASTEXITCODE -eq 0) {
    Write-Host "Redis服务已启动!" -ForegroundColor Green
    Write-Host "连接信息:" -ForegroundColor Cyan
    Write-Host "  主机: localhost" -ForegroundColor White
    Write-Host "  端口: 6379" -ForegroundColor White
    Write-Host "  密码: 无" -ForegroundColor White
    Write-Host ""
    Write-Host "要停止Redis服务，运行: docker stop file-service-redis" -ForegroundColor Yellow
} else {
    Write-Host "启动Redis失败!" -ForegroundColor Red
    exit 1
}
