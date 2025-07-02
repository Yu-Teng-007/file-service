import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { promises as fs } from 'fs'
import * as crypto from 'crypto'
import {
  UnsupportedFileTypeException,
  FileValidationException,
  InsufficientPermissionException,
} from '../../common/exceptions/custom.exceptions'

export interface SecurityScanResult {
  isSecure: boolean
  threats: string[]
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  details?: any
}

export interface VirusScanResult {
  isClean: boolean
  threats: string[]
  scanEngine: string
  scanTime: Date
}

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name)
  private maliciousPatterns: RegExp[]
  private suspiciousExtensions: Set<string>
  private blacklistedHashes: Set<string>

  constructor(private readonly configService: ConfigService) {
    this.initializeSecurityPatterns()
  }

  /**
   * 初始化安全模式
   */
  private initializeSecurityPatterns(): void {
    // 恶意代码模式
    this.maliciousPatterns = [
      // JavaScript 恶意模式
      /eval\s*\(/gi,
      /Function\s*\(/gi,
      /setTimeout\s*\(/gi,
      /setInterval\s*\(/gi,
      /document\.write/gi,
      /innerHTML\s*=/gi,
      /outerHTML\s*=/gi,
      /\.appendChild/gi,
      /\.insertBefore/gi,
      /window\.location/gi,
      /location\.href/gi,
      /location\.replace/gi,
      /location\.assign/gi,

      // PHP 恶意模式
      /\<\?php/gi,
      /eval\s*\(/gi,
      /exec\s*\(/gi,
      /system\s*\(/gi,
      /shell_exec\s*\(/gi,
      /passthru\s*\(/gi,
      /file_get_contents\s*\(/gi,
      /file_put_contents\s*\(/gi,
      /fopen\s*\(/gi,
      /fwrite\s*\(/gi,
      /include\s*\(/gi,
      /require\s*\(/gi,
      /include_once\s*\(/gi,
      /require_once\s*\(/gi,

      // SQL 注入模式
      /union\s+select/gi,
      /drop\s+table/gi,
      /delete\s+from/gi,
      /insert\s+into/gi,
      /update\s+set/gi,
      /alter\s+table/gi,
      /create\s+table/gi,

      // 通用恶意模式
      /base64_decode/gi,
      /gzinflate/gi,
      /str_rot13/gi,
      /\$_GET\[/gi,
      /\$_POST\[/gi,
      /\$_REQUEST\[/gi,
      /\$_COOKIE\[/gi,
      /\$_SESSION\[/gi,
      /\$_SERVER\[/gi,
      /\$_FILES\[/gi,
      /\$_ENV\[/gi,

      // 脚本注入模式
      /<script[^>]*>/gi,
      /<\/script>/gi,
      /<iframe[^>]*>/gi,
      /<\/iframe>/gi,
      /<object[^>]*>/gi,
      /<\/object>/gi,
      /<embed[^>]*>/gi,
      /<\/embed>/gi,
      /<form[^>]*>/gi,
      /<\/form>/gi,

      // 可疑字符串
      /javascript:/gi,
      /vbscript:/gi,
      /data:text\/html/gi,
      /data:application\/javascript/gi,
    ]

    // 可疑文件扩展名
    this.suspiciousExtensions = new Set([
      '.exe',
      '.bat',
      '.cmd',
      '.com',
      '.pif',
      '.scr',
      '.vbs',
      '.vbe',
      '.js',
      '.jse',
      '.jar',
      '.class',
      '.php',
      '.asp',
      '.aspx',
      '.jsp',
      '.pl',
      '.py',
      '.rb',
      '.sh',
      '.ps1',
      '.psm1',
      '.psd1',
      '.msi',
      '.msp',
      '.mst',
      '.reg',
      '.hta',
      '.chm',
      '.hlp',
      '.url',
      '.lnk',
      '.scf',
      '.inf',
      '.ini',
    ])

    // 已知恶意文件哈希（示例）
    this.blacklistedHashes = new Set([
      // 这里应该包含已知恶意文件的哈希值
      // 实际使用时应该从威胁情报数据库获取
    ])
  }

  /**
   * 执行文件安全扫描
   */
  async scanFile(filePath: string, originalName: string): Promise<SecurityScanResult> {
    this.logger.debug(`开始安全扫描: ${originalName}`)

    const threats: string[] = []
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'

    try {
      // 1. 文件扩展名检查
      const extensionThreats = await this.checkFileExtension(originalName)
      threats.push(...extensionThreats)

      // 2. 文件哈希检查
      const hashThreats = await this.checkFileHash(filePath)
      threats.push(...hashThreats)

      // 3. 文件内容扫描
      const contentThreats = await this.scanFileContent(filePath, originalName)
      threats.push(...contentThreats)

      // 4. 文件头部检查
      const headerThreats = await this.checkFileHeader(filePath, originalName)
      threats.push(...headerThreats)

      // 5. 病毒扫描（如果启用）
      if (this.configService.get<boolean>('security.enableVirusScan')) {
        const virusThreats = await this.performVirusScan(filePath)
        threats.push(...virusThreats.threats)
      }

      // 评估风险级别
      riskLevel = this.assessRiskLevel(threats)

      const result: SecurityScanResult = {
        isSecure: threats.length === 0,
        threats,
        riskLevel,
        details: {
          scannedAt: new Date(),
          fileName: originalName,
          filePath,
        },
      }

      this.logger.debug(
        `安全扫描完成: ${originalName}, 威胁数量: ${threats.length}, 风险级别: ${riskLevel}`
      )
      return result
    } catch (error) {
      this.logger.error(`安全扫描失败: ${originalName}`, error)
      return {
        isSecure: false,
        threats: ['扫描过程中发生错误'],
        riskLevel: 'high',
        details: { error: error.message },
      }
    }
  }

  /**
   * 检查文件扩展名
   */
  private async checkFileExtension(fileName: string): Promise<string[]> {
    const threats: string[] = []
    const ext = fileName.toLowerCase().split('.').pop()

    if (ext && this.suspiciousExtensions.has(`.${ext}`)) {
      threats.push(`可疑文件扩展名: .${ext}`)
    }

    // 检查双重扩展名
    const parts = fileName.toLowerCase().split('.')
    if (parts.length > 2) {
      const secondExt = parts[parts.length - 2]
      if (this.suspiciousExtensions.has(`.${secondExt}`)) {
        threats.push(`可疑的双重扩展名: .${secondExt}.${ext}`)
      }
    }

    return threats
  }

  /**
   * 检查文件哈希
   */
  private async checkFileHash(filePath: string): Promise<string[]> {
    const threats: string[] = []

    try {
      const fileBuffer = await fs.readFile(filePath)
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex')

      if (this.blacklistedHashes.has(hash)) {
        threats.push(`文件匹配已知恶意哈希: ${hash.substring(0, 16)}...`)
      }
    } catch (error) {
      this.logger.warn(`无法计算文件哈希: ${filePath}`, error)
    }

    return threats
  }

  /**
   * 扫描文件内容
   */
  private async scanFileContent(filePath: string, fileName: string): Promise<string[]> {
    const threats: string[] = []

    try {
      const fileBuffer = await fs.readFile(filePath)
      const content = fileBuffer.toString('utf8', 0, Math.min(fileBuffer.length, 1024 * 1024)) // 最多读取1MB

      // 检查恶意模式
      for (const pattern of this.maliciousPatterns) {
        if (pattern.test(content)) {
          threats.push(`检测到恶意代码模式: ${pattern.source}`)
        }
      }

      // 检查可疑字符串
      const suspiciousStrings = [
        'eval(',
        'exec(',
        'system(',
        'shell_exec(',
        'base64_decode',
        'gzinflate',
        'str_rot13',
        'document.write',
        'innerHTML=',
        'outerHTML=',
        'window.location',
        'location.href',
        '<script',
        '</script>',
        '<iframe',
        '</iframe>',
        'javascript:',
        'vbscript:',
        'data:text/html',
      ]

      for (const suspicious of suspiciousStrings) {
        if (content.toLowerCase().includes(suspicious.toLowerCase())) {
          threats.push(`检测到可疑字符串: ${suspicious}`)
        }
      }

      // 检查编码内容
      if (this.containsEncodedContent(content)) {
        threats.push('文件包含可疑的编码内容')
      }
    } catch (error) {
      this.logger.warn(`无法读取文件内容: ${filePath}`, error)
    }

    return threats
  }

  /**
   * 检查文件头部
   */
  private async checkFileHeader(filePath: string, fileName: string): Promise<string[]> {
    const threats: string[] = []

    try {
      const fileBuffer = await fs.readFile(filePath)
      const header = fileBuffer.slice(0, 512) // 读取前512字节

      // 检查文件签名是否与扩展名匹配
      const ext = fileName.toLowerCase().split('.').pop()
      const expectedSignatures = this.getExpectedFileSignatures(ext)

      if (expectedSignatures.length > 0) {
        const matchesSignature = expectedSignatures.some(signature =>
          header.slice(0, signature.length).equals(signature)
        )

        if (!matchesSignature) {
          threats.push(`文件头部与扩展名不匹配: .${ext}`)
        }
      }

      // 检查可执行文件头部
      if (header.slice(0, 2).equals(Buffer.from([0x4d, 0x5a]))) {
        // MZ header
        threats.push('检测到可执行文件头部 (PE)')
      }

      if (header.slice(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) {
        // ELF header
        threats.push('检测到可执行文件头部 (ELF)')
      }
    } catch (error) {
      this.logger.warn(`无法读取文件头部: ${filePath}`, error)
    }

    return threats
  }

  /**
   * 执行病毒扫描
   */
  private async performVirusScan(filePath: string): Promise<VirusScanResult> {
    // 这里应该集成实际的病毒扫描引擎
    // 例如 ClamAV、VirusTotal API 等

    const apiKey = this.configService.get<string>('security.virusScanApiKey')
    if (!apiKey) {
      this.logger.warn('病毒扫描API密钥未配置')
      return {
        isClean: true,
        threats: [],
        scanEngine: 'none',
        scanTime: new Date(),
      }
    }

    // 模拟病毒扫描结果
    // 实际实现应该调用真实的病毒扫描API
    return {
      isClean: true,
      threats: [],
      scanEngine: 'mock',
      scanTime: new Date(),
    }
  }

  /**
   * 评估风险级别
   */
  private assessRiskLevel(threats: string[]): 'low' | 'medium' | 'high' | 'critical' {
    if (threats.length === 0) return 'low'

    const criticalKeywords = ['恶意代码', '可执行文件', '已知恶意哈希']
    const highKeywords = ['可疑字符串', '编码内容', '双重扩展名']
    const mediumKeywords = ['文件头部不匹配', '可疑扩展名']

    for (const threat of threats) {
      if (criticalKeywords.some(keyword => threat.includes(keyword))) {
        return 'critical'
      }
    }

    for (const threat of threats) {
      if (highKeywords.some(keyword => threat.includes(keyword))) {
        return 'high'
      }
    }

    for (const threat of threats) {
      if (mediumKeywords.some(keyword => threat.includes(keyword))) {
        return 'medium'
      }
    }

    return 'low'
  }

  /**
   * 检查是否包含编码内容
   */
  private containsEncodedContent(content: string): boolean {
    // 检查Base64编码
    const base64Pattern = /[A-Za-z0-9+\/]{20,}={0,2}/g
    const base64Matches = content.match(base64Pattern)

    if (base64Matches && base64Matches.length > 5) {
      return true
    }

    // 检查十六进制编码
    const hexPattern = /\\x[0-9a-fA-F]{2}/g
    const hexMatches = content.match(hexPattern)

    if (hexMatches && hexMatches.length > 10) {
      return true
    }

    // 检查Unicode编码
    const unicodePattern = /\\u[0-9a-fA-F]{4}/g
    const unicodeMatches = content.match(unicodePattern)

    if (unicodeMatches && unicodeMatches.length > 5) {
      return true
    }

    return false
  }

  /**
   * 获取预期的文件签名
   */
  private getExpectedFileSignatures(extension: string): Buffer[] {
    const signatures: Record<string, Buffer[]> = {
      jpg: [Buffer.from([0xff, 0xd8, 0xff])],
      jpeg: [Buffer.from([0xff, 0xd8, 0xff])],
      png: [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      gif: [Buffer.from([0x47, 0x49, 0x46, 0x38])],
      bmp: [Buffer.from([0x42, 0x4d])],
      tiff: [
        Buffer.from([0x49, 0x49, 0x2a, 0x00]), // Little endian
        Buffer.from([0x4d, 0x4d, 0x00, 0x2a]), // Big endian
      ],
      tif: [
        Buffer.from([0x49, 0x49, 0x2a, 0x00]), // Little endian
        Buffer.from([0x4d, 0x4d, 0x00, 0x2a]), // Big endian
      ],
      webp: [Buffer.from([0x52, 0x49, 0x46, 0x46])],
      avif: [Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66])],
      ico: [Buffer.from([0x00, 0x00, 0x01, 0x00])],
      heic: [Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])],
      heif: [Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x66])],
      pdf: [Buffer.from([0x25, 0x50, 0x44, 0x46])],
      zip: [Buffer.from([0x50, 0x4b, 0x03, 0x04])],
      rar: [Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])],
    }

    return signatures[extension] || []
  }
}
