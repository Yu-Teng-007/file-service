# Redis启动脚本
# 使用Docker启动Redis服务

Write-Host "Starting Redis service..." -ForegroundColor Green

# 检查Docker是否安装
try {
    docker --version | Out-Null
    Write-Host "Docker is installed" -ForegroundColor Green
} catch {
    Write-Host "Error: Docker is not installed or not running" -ForegroundColor Red
    Write-Host "Please install Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# 停止现有的Redis容器（如果存在）
Write-Host "Stopping existing Redis container..." -ForegroundColor Yellow
docker stop file-service-redis 2>$null
docker rm file-service-redis 2>$null

# 启动新的Redis容器
Write-Host "Starting Redis container..." -ForegroundColor Green
docker run -d `
    --name file-service-redis `
    -p 6379:6379 `
    redis:7-alpine `
    redis-server --appendonly yes

if ($LASTEXITCODE -eq 0) {
    Write-Host "Redis service started successfully!" -ForegroundColor Green
    Write-Host "Connection info:" -ForegroundColor Cyan
    Write-Host "  Host: localhost" -ForegroundColor White
    Write-Host "  Port: 6379" -ForegroundColor White
    Write-Host "  Password: none" -ForegroundColor White
    Write-Host ""
    Write-Host "To stop Redis service, run: docker stop file-service-redis" -ForegroundColor Yellow
} else {
    Write-Host "Failed to start Redis!" -ForegroundColor Red
    exit 1
}
