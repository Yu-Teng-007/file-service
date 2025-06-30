# File Service 启动脚本

Write-Host "🚀 启动文件服务系统..." -ForegroundColor Green

# 检查 Node.js 是否安装
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 错误: 未找到 Node.js，请先安装 Node.js 18+" -ForegroundColor Red
    exit 1
}

# 检查 npm 是否安装
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 错误: 未找到 npm" -ForegroundColor Red
    exit 1
}

# 检查是否存在 .env 文件
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  未找到 .env 文件，从 .env.example 复制..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✅ 已创建 .env 文件，请根据需要修改配置" -ForegroundColor Green
}

# 检查是否已安装依赖
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 安装依赖包..." -ForegroundColor Blue
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 依赖安装失败" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ 依赖安装完成" -ForegroundColor Green
}

# 创建必要的目录
$directories = @("uploads", "uploads/temp", "uploads/images", "uploads/scripts", "uploads/styles", "uploads/fonts", "uploads/documents", "uploads/music", "uploads/videos", "uploads/archives", "logs", "data")

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "📁 创建目录: $dir" -ForegroundColor Cyan
    }
}

Write-Host "✅ 目录结构创建完成" -ForegroundColor Green

# 启动开发服务器
Write-Host "🔥 启动开发服务器..." -ForegroundColor Blue
Write-Host "📍 服务地址: http://localhost:3001" -ForegroundColor Cyan
Write-Host "📚 API文档: http://localhost:3001/api" -ForegroundColor Cyan
Write-Host "按 Ctrl+C 停止服务" -ForegroundColor Yellow
Write-Host ""

npm run start:dev
