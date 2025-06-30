# Redis连接测试脚本

Write-Host "测试Redis连接..." -ForegroundColor Green

# 测试Redis连接
try {
    $response = docker exec file-service-redis redis-cli ping
    if ($response -eq "PONG") {
        Write-Host "✅ Redis连接成功!" -ForegroundColor Green
        
        # 测试基本操作
        Write-Host "测试基本操作..." -ForegroundColor Cyan
        docker exec file-service-redis redis-cli set test-key "Hello Redis"
        $value = docker exec file-service-redis redis-cli get test-key
        Write-Host "设置值: Hello Redis" -ForegroundColor White
        Write-Host "获取值: $value" -ForegroundColor White
        
        # 清理测试数据
        docker exec file-service-redis redis-cli del test-key
        Write-Host "测试数据已清理" -ForegroundColor Yellow
        
        Write-Host ""
        Write-Host "Redis服务运行正常，可以在.env文件中启用Redis缓存:" -ForegroundColor Green
        Write-Host "REDIS_HOST=localhost" -ForegroundColor White
        Write-Host "REDIS_PORT=6379" -ForegroundColor White
    } else {
        Write-Host "❌ Redis响应异常: $response" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Redis连接失败!" -ForegroundColor Red
    Write-Host "请确保Redis服务已启动: .\scripts\start-redis.ps1" -ForegroundColor Yellow
}
