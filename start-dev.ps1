# 快速启动开发环境脚本
# Quick development environment startup script

Write-Host "🚀 Quick Start - File Service Development Environment" -ForegroundColor Green
Write-Host ""

# 检查基本要求
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js not found. Please install Node.js 18+" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "package.json")) {
    Write-Host "❌ Please run from project root directory" -ForegroundColor Red
    exit 1
}

# 快速安装依赖（如果需要）
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing backend dependencies..." -ForegroundColor Blue
    npm install --silent
}

if (-not (Test-Path "file-manager-frontend/node_modules")) {
    Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Blue
    Push-Location "file-manager-frontend"
    npm install --silent
    Pop-Location
}

# 创建基本环境文件
if (-not (Test-Path ".env")) {
    Write-Host "🔧 Creating backend .env file..." -ForegroundColor Blue
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
    }
}

if (-not (Test-Path "file-manager-frontend/.env.local")) {
    Write-Host "🔧 Creating frontend .env.local file..." -ForegroundColor Blue
    $frontendEnv = @"
VITE_APP_TITLE=File Management System - Development
VITE_API_BASE_URL=http://localhost:3001
VITE_API_KEY=default-api-key
"@
    Set-Content -Path "file-manager-frontend/.env.local" -Value $frontendEnv
}

Write-Host ""
Write-Host "🎯 Starting services..." -ForegroundColor Green
Write-Host "📍 Backend: http://localhost:3001" -ForegroundColor Cyan
Write-Host "📍 Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "📚 API Docs: http://localhost:3001/api" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

# 启动后端
$backend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run start:dev" -PassThru

# 等待后端启动
Start-Sleep -Seconds 3

# 启动前端
$frontend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\file-manager-frontend'; npm run dev" -PassThru

Write-Host "✅ Services started in separate windows" -ForegroundColor Green
Write-Host "💡 Close the PowerShell windows to stop the services" -ForegroundColor Yellow
