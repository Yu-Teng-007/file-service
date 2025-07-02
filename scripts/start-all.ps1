# 一键启动前后端项目脚本
# 同时启动文件服务后端和前端管理界面

param(
    [switch]$SkipDependencies,
    [switch]$SkipRedis,
    [string]$BackendPort = "3001",
    [string]$FrontendPort = "3000"
)

# 颜色输出函数
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

Write-ColorOutput "🚀 Starting File Service System (Frontend + Backend)..." "Green"
Write-Host ""

# 检查必要工具
Write-ColorOutput "🔍 Checking required tools..." "Blue"

# 检查 Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-ColorOutput "❌ Error: Node.js not found, please install Node.js 18+" "Red"
    exit 1
}

# 检查 npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-ColorOutput "❌ Error: npm not found" "Red"
    exit 1
}

Write-ColorOutput "✅ Node.js and npm are available" "Green"

# 检查项目结构
if (-not (Test-Path "package.json")) {
    Write-ColorOutput "❌ Error: Backend package.json not found. Please run from project root." "Red"
    exit 1
}

if (-not (Test-Path "file-manager-frontend")) {
    Write-ColorOutput "❌ Error: Frontend directory not found" "Red"
    exit 1
}

# 启动 Redis (可选)
if (-not $SkipRedis) {
    Write-ColorOutput "🔧 Starting Redis service..." "Blue"
    try {
        & ".\scripts\start-redis.ps1"
        Write-ColorOutput "✅ Redis service started" "Green"
    } catch {
        Write-ColorOutput "⚠️  Warning: Failed to start Redis. Continuing without cache..." "Yellow"
    }
    Write-Host ""
}

# 安装后端依赖
if (-not $SkipDependencies) {
    Write-ColorOutput "📦 Installing backend dependencies..." "Blue"
    if (-not (Test-Path "node_modules")) {
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-ColorOutput "❌ Backend dependencies installation failed" "Red"
            exit 1
        }
    }
    Write-ColorOutput "✅ Backend dependencies ready" "Green"
    
    # 安装前端依赖
    Write-ColorOutput "📦 Installing frontend dependencies..." "Blue"
    Push-Location "file-manager-frontend"
    try {
        if (-not (Test-Path "node_modules")) {
            npm install
            if ($LASTEXITCODE -ne 0) {
                Write-ColorOutput "❌ Frontend dependencies installation failed" "Red"
                exit 1
            }
        }
        Write-ColorOutput "✅ Frontend dependencies ready" "Green"
    } finally {
        Pop-Location
    }
}

# 创建必要的目录
Write-ColorOutput "📁 Creating necessary directories..." "Blue"
$directories = @("uploads", "uploads/temp", "uploads/images", "uploads/scripts", "uploads/styles", "uploads/fonts", "uploads/documents", "uploads/music", "uploads/videos", "uploads/archives", "logs", "data")

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-ColorOutput "📁 Created directory: $dir" "Cyan"
    }
}

# 检查环境文件
Write-ColorOutput "🔧 Checking environment configuration..." "Blue"

# 后端环境文件
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-ColorOutput "✅ Created backend .env file from example" "Green"
    } else {
        Write-ColorOutput "⚠️  Warning: No .env.example found for backend" "Yellow"
    }
}

# 前端环境文件
Push-Location "file-manager-frontend"
try {
    if (-not (Test-Path ".env.local")) {
        $frontendEnvContent = @"
# 本地开发环境配置
VITE_APP_TITLE=File Management System - Development
VITE_API_BASE_URL=http://localhost:$BackendPort
VITE_API_KEY=default-api-key
"@
        Set-Content -Path ".env.local" -Value $frontendEnvContent
        Write-ColorOutput "✅ Created frontend .env.local file" "Green"
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-ColorOutput "🚀 Starting services..." "Green"
Write-Host ""

# 启动后端服务
Write-ColorOutput "🔥 Starting backend server on port $BackendPort..." "Blue"
$backendJob = Start-Job -ScriptBlock {
    param($BackendPort)
    Set-Location $using:PWD
    $env:PORT = $BackendPort
    npm run start:dev
} -ArgumentList $BackendPort

# 等待后端启动
Write-ColorOutput "⏳ Waiting for backend to start..." "Yellow"
Start-Sleep -Seconds 5

# 启动前端服务
Write-ColorOutput "🎨 Starting frontend server on port $FrontendPort..." "Blue"
$frontendJob = Start-Job -ScriptBlock {
    param($FrontendPort)
    Set-Location "$using:PWD\file-manager-frontend"
    $env:PORT = $FrontendPort
    npm run dev
} -ArgumentList $FrontendPort

# 等待前端启动
Write-ColorOutput "⏳ Waiting for frontend to start..." "Yellow"
Start-Sleep -Seconds 3

Write-Host ""
Write-ColorOutput "🎉 Services are starting up!" "Green"
Write-Host ""
Write-ColorOutput "📍 Backend API: http://localhost:$BackendPort" "Cyan"
Write-ColorOutput "📍 Frontend App: http://localhost:$FrontendPort" "Cyan"
Write-ColorOutput "📚 API Documentation: http://localhost:$BackendPort/api" "Cyan"
Write-Host ""
Write-ColorOutput "💡 Tips:" "Yellow"
Write-ColorOutput "  - Press Ctrl+C to stop all services" "White"
Write-ColorOutput "  - Check logs below for any startup issues" "White"
Write-ColorOutput "  - Frontend will automatically open in your browser" "White"
Write-Host ""

# 监控作业状态
try {
    Write-ColorOutput "📊 Monitoring services (Press Ctrl+C to stop)..." "Blue"
    Write-Host ""
    
    while ($true) {
        # 检查后端作业状态
        if ($backendJob.State -eq "Failed") {
            Write-ColorOutput "❌ Backend service failed!" "Red"
            Receive-Job $backendJob
            break
        }
        
        # 检查前端作业状态
        if ($frontendJob.State -eq "Failed") {
            Write-ColorOutput "❌ Frontend service failed!" "Red"
            Receive-Job $frontendJob
            break
        }
        
        Start-Sleep -Seconds 2
    }
} finally {
    # 清理作业
    Write-ColorOutput "🛑 Stopping services..." "Yellow"
    
    if ($backendJob) {
        Stop-Job $backendJob -ErrorAction SilentlyContinue
        Remove-Job $backendJob -ErrorAction SilentlyContinue
    }
    
    if ($frontendJob) {
        Stop-Job $frontendJob -ErrorAction SilentlyContinue
        Remove-Job $frontendJob -ErrorAction SilentlyContinue
    }
    
    Write-ColorOutput "✅ All services stopped" "Green"
}
