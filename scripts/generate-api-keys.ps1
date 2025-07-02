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
        Write-Warning "⚠️  File not found: $FilePath"
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
    Write-Host "✅ Updated: $FilePath" -ForegroundColor Green
}

# 主函数
function Main {
    Write-Host "🔐 Generating API Keys..." -ForegroundColor Cyan
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
        
        Write-Host "📝 $($env.name.ToUpper()) Environment:" -ForegroundColor Yellow
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
    Write-Host "💾 Keys saved to: $keysFile" -ForegroundColor Green
    Write-Host "⚠️  Please keep this file secure and do not commit to version control!" -ForegroundColor Red

    Write-Host ""
    Write-Host "🎉 API Keys generation completed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Next steps:" -ForegroundColor Cyan
    Write-Host "1. Check the updated environment files"
    Write-Host "2. Restart the application to apply new keys"
    Write-Host "3. Add generated-keys.json to .gitignore"
}

# 运行脚本
Main
