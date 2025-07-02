# API Key 生成脚本 (PowerShell 版本)
# 用于为不同环境生成安全的 API Key

param(
    [string]$Environment = "all",
    [int]$KeyLength = 32
)

# 生成随机字符串
function Generate-RandomString {
    param([int]$Length = 32)
    
    $bytes = New-Object byte[] $Length
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    
    return [System.Convert]::ToHexString($bytes).ToLower()
}

# 生成 API Key
function Generate-ApiKey {
    param(
        [string]$Environment,
        [int]$Length = 32
    )
    
    $timestamp = Get-Date -Format "yyyy"
    $randomString = Generate-RandomString -Length $Length
    return "${Environment}_fs_${timestamp}_${randomString}"
}

# 生成 JWT Secret
function Generate-JwtSecret {
    param([int]$Length = 64)
    
    $bytes = New-Object byte[] $Length
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    
    return [System.Convert]::ToBase64String($bytes)
}

# 更新环境文件
function Update-EnvFile {
    param(
        [string]$FilePath,
        [string]$ApiKey,
        [string]$JwtSecret = $null
    )
    
    if (-not (Test-Path $FilePath)) {
        Write-Warning "⚠️  文件不存在: $FilePath"
        return
    }
    
    $content = Get-Content $FilePath -Raw
    
    # 更新 API Key
    $content = $content -replace 'API_KEY=.*', "API_KEY=$ApiKey"
    $content = $content -replace 'VITE_API_KEY=.*', "VITE_API_KEY=$ApiKey"
    
    # 更新 JWT Secret (如果提供)
    if ($JwtSecret) {
        $content = $content -replace 'JWT_SECRET=.*', "JWT_SECRET=$JwtSecret"
    }
    
    Set-Content -Path $FilePath -Value $content -NoNewline
    Write-Host "✅ 已更新: $FilePath" -ForegroundColor Green
}

# 主函数
function Main {
    Write-Host "🔐 生成 API Keys..." -ForegroundColor Cyan
    Write-Host ""
    
    $environments = @(
        @{ name = "dev"; envFile = ".env.development"; frontendEnvFile = "file-manager-frontend\.env.development" },
        @{ name = "test"; envFile = ".env.test"; frontendEnvFile = "file-manager-frontend\.env.test" },
        @{ name = "prod"; envFile = ".env.production"; frontendEnvFile = "file-manager-frontend\.env.production" }
    )
    
    $generatedKeys = @{}
    
    foreach ($env in $environments) {
        if ($Environment -ne "all" -and $Environment -ne $env.name) {
            continue
        }
        
        $apiKey = Generate-ApiKey -Environment $env.name -Length $KeyLength
        $jwtSecret = Generate-JwtSecret
        
        $generatedKeys[$env.name] = @{
            apiKey = $apiKey
            jwtSecret = $jwtSecret
        }
        
        Write-Host "📝 $($env.name.ToUpper()) 环境:" -ForegroundColor Yellow
        Write-Host "   API Key: $apiKey" -ForegroundColor White
        Write-Host "   JWT Secret: $jwtSecret" -ForegroundColor White
        Write-Host ""
        
        # 更新后端环境文件
        $backendEnvPath = Join-Path $PWD $env.envFile
        Update-EnvFile -FilePath $backendEnvPath -ApiKey $apiKey -JwtSecret $jwtSecret
        
        # 更新前端环境文件
        $frontendEnvPath = Join-Path $PWD $env.frontendEnvFile
        Update-EnvFile -FilePath $frontendEnvPath -ApiKey $apiKey
    }
    
    # 保存生成的密钥到文件
    $keysFile = Join-Path $PWD "generated-keys.json"
    $generatedKeys | ConvertTo-Json -Depth 3 | Set-Content $keysFile
    Write-Host "💾 密钥已保存到: $keysFile" -ForegroundColor Green
    Write-Host "⚠️  请妥善保管此文件，不要提交到版本控制系统！" -ForegroundColor Red
    
    Write-Host ""
    Write-Host "🎉 API Keys 生成完成！" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 下一步操作：" -ForegroundColor Cyan
    Write-Host "1. 检查更新后的环境文件"
    Write-Host "2. 重启应用以使新密钥生效"
    Write-Host "3. 将 generated-keys.json 添加到 .gitignore"
}

# 运行脚本
Main
