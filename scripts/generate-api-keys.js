#!/usr/bin/env node

/**
 * API Key 生成脚本
 * 用于为不同环境生成安全的 API Key
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * 生成安全的 API Key
 * @param {string} environment - 环境名称 (dev, test, prod)
 * @param {number} length - 密钥长度
 * @returns {string} 生成的 API Key
 */
function generateApiKey(environment, length = 64) {
  const timestamp = new Date().getFullYear();
  const randomBytes = crypto.randomBytes(length).toString('hex');
  return `${environment}_fs_${timestamp}_${randomBytes}`;
}

/**
 * 生成 JWT Secret
 * @param {number} length - 密钥长度
 * @returns {string} 生成的 JWT Secret
 */
function generateJwtSecret(length = 64) {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * 更新环境文件中的 API Key
 * @param {string} filePath - 环境文件路径
 * @param {string} apiKey - 新的 API Key
 * @param {string} jwtSecret - 新的 JWT Secret (可选)
 */
function updateEnvFile(filePath, apiKey, jwtSecret = null) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  文件不存在: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // 更新 API Key
  content = content.replace(/API_KEY=.*/g, `API_KEY=${apiKey}`);
  content = content.replace(/VITE_API_KEY=.*/g, `VITE_API_KEY=${apiKey}`);
  
  // 更新 JWT Secret (如果提供)
  if (jwtSecret) {
    content = content.replace(/JWT_SECRET=.*/g, `JWT_SECRET=${jwtSecret}`);
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`✅ 已更新: ${filePath}`);
}

/**
 * 主函数
 */
function main() {
  console.log('🔐 生成 API Keys...\n');

  const environments = [
    { name: 'dev', envFile: '.env.development', frontendEnvFile: 'file-manager-frontend/.env.development' },
    { name: 'test', envFile: '.env.test', frontendEnvFile: 'file-manager-frontend/.env.test' },
    { name: 'prod', envFile: '.env.production', frontendEnvFile: 'file-manager-frontend/.env.production' }
  ];

  const generatedKeys = {};

  environments.forEach(env => {
    const apiKey = generateApiKey(env.name);
    const jwtSecret = generateJwtSecret();
    
    generatedKeys[env.name] = {
      apiKey,
      jwtSecret
    };

    console.log(`📝 ${env.name.toUpperCase()} 环境:`);
    console.log(`   API Key: ${apiKey}`);
    console.log(`   JWT Secret: ${jwtSecret}`);
    console.log('');

    // 更新后端环境文件
    const backendEnvPath = path.join(process.cwd(), env.envFile);
    updateEnvFile(backendEnvPath, apiKey, jwtSecret);

    // 更新前端环境文件
    const frontendEnvPath = path.join(process.cwd(), env.frontendEnvFile);
    updateEnvFile(frontendEnvPath, apiKey);
  });

  // 保存生成的密钥到文件
  const keysFile = path.join(process.cwd(), 'generated-keys.json');
  fs.writeFileSync(keysFile, JSON.stringify(generatedKeys, null, 2));
  console.log(`💾 密钥已保存到: ${keysFile}`);
  console.log('⚠️  请妥善保管此文件，不要提交到版本控制系统！');

  console.log('\n🎉 API Keys 生成完成！');
  console.log('\n📋 下一步操作：');
  console.log('1. 检查更新后的环境文件');
  console.log('2. 重启应用以使新密钥生效');
  console.log('3. 将 generated-keys.json 添加到 .gitignore');
}

// 运行脚本
if (require.main === module) {
  main();
}

module.exports = {
  generateApiKey,
  generateJwtSecret,
  updateEnvFile
};
