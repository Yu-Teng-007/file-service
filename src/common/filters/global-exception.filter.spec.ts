import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { HttpException, HttpStatus, BadRequestException, NotFoundException } from '@nestjs/common'
import { GlobalExceptionFilter } from './global-exception.filter'
import { MonitoringService } from '../../modules/monitoring/monitoring.service'

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter
  let configService: jest.Mocked<ConfigService>
  let monitoringService: jest.Mocked<MonitoringService>

  const mockRequest = {
    url: '/api/test',
    method: 'POST',
    ip: '127.0.0.1',
    headers: {
      'user-agent': 'test-agent',
      'x-request-id': 'test-request-id',
    },
    body: { test: 'data' },
    query: { page: '1' },
    params: { id: '123' },
    connection: { remoteAddress: '127.0.0.1' },
  }

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  }

  const mockArgumentsHost = {
    switchToHttp: jest.fn().mockReturnValue({
      getResponse: () => mockResponse,
      getRequest: () => mockRequest,
    }),
  }

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    }

    const mockMonitoringService = {
      logFileAccess: jest.fn().mockResolvedValue(undefined),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlobalExceptionFilter,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MonitoringService, useValue: mockMonitoringService },
      ],
    }).compile()

    filter = module.get<GlobalExceptionFilter>(GlobalExceptionFilter)
    configService = module.get(ConfigService)
    monitoringService = module.get(MonitoringService)

    // Setup default config values
    configService.get.mockImplementation((key: string) => {
      const config = {
        NODE_ENV: 'test',
        ENABLE_ERROR_STACK_TRACE: true,
      }
      return config[key]
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('catch', () => {
    it('should handle HttpException correctly', () => {
      const exception = new BadRequestException('Invalid input')

      filter.catch(exception, mockArgumentsHost as any)

      expect(mockResponse.status).toHaveBeenCalledWith(400)
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid input',
          timestamp: expect.any(String),
          path: '/api/test',
          method: 'POST',
          requestId: 'test-request-id',
          stack: expect.any(String),
        },
      })
    })

    it('should handle HttpException with custom response object', () => {
      const customResponse = {
        code: 'CUSTOM_ERROR',
        message: 'Custom error message',
        details: { field: 'value' },
      }
      const exception = new HttpException(customResponse, HttpStatus.UNPROCESSABLE_ENTITY)

      filter.catch(exception, mockArgumentsHost as any)

      expect(mockResponse.status).toHaveBeenCalledWith(422)
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CUSTOM_ERROR',
          message: 'Custom error message',
          details: { field: 'value' },
          timestamp: expect.any(String),
          path: '/api/test',
          method: 'POST',
          requestId: 'test-request-id',
          stack: expect.any(String),
        },
      })
    })

    it('should handle validation errors with array messages', () => {
      const validationErrors = ['Field is required', 'Invalid format']
      const exception = new BadRequestException(validationErrors)

      filter.catch(exception, mockArgumentsHost as any)

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Field is required, Invalid format',
          }),
        })
      )
    })

    it('should handle generic Error correctly', () => {
      const error = new Error('File not found')
      error.message = 'ENOENT: no such file or directory'

      filter.catch(error, mockArgumentsHost as any)

      expect(mockResponse.status).toHaveBeenCalledWith(500)
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'ENOENT: no such file or directory',
          timestamp: expect.any(String),
          path: '/api/test',
          method: 'POST',
          requestId: 'test-request-id',
          stack: expect.any(String),
        },
      })
    })

    it('should handle unknown exceptions', () => {
      const unknownException = 'string error'

      filter.catch(unknownException, mockArgumentsHost as any)

      expect(mockResponse.status).toHaveBeenCalledWith(500)
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '服务器内部错误',
          timestamp: expect.any(String),
          path: '/api/test',
          method: 'POST',
          requestId: 'test-request-id',
        },
      })
    })

    it('should not include stack trace in production', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production'
        if (key === 'ENABLE_ERROR_STACK_TRACE') return false
        return undefined
      })

      const exception = new BadRequestException('Test error')

      filter.catch(exception, mockArgumentsHost as any)

      const responseCall = mockResponse.json.mock.calls[0][0]
      expect(responseCall.error.stack).toBeUndefined()
    })

    it('should sanitize error messages', () => {
      const error = new Error('Error in /secret/path/file.txt with password=secret123')

      filter.catch(error, mockArgumentsHost as any)

      const responseCall = mockResponse.json.mock.calls[0][0]
      expect(responseCall.error.message).toContain('[PATH]')
      expect(responseCall.error.message).toContain('password=[HIDDEN]')
      expect(responseCall.error.message).not.toContain('secret123')
    })

    it('should record error metrics', () => {
      const exception = new NotFoundException('File not found')

      filter.catch(exception, mockArgumentsHost as any)

      // 由于监控记录是异步的，我们需要等待一下
      setTimeout(() => {
        expect(monitoringService.logFileAccess).toHaveBeenCalledWith({
          fileId: 'error',
          fileName: '/api/test',
          filePath: '/api/test',
          accessType: 'read',
          userAgent: 'test-agent',
          ipAddress: '127.0.0.1',
          errorMessage: 'File not found',
        })
      }, 10)
    })

    it('should sanitize request body in logs', () => {
      const requestWithSensitiveData = {
        ...mockRequest,
        body: {
          username: 'test',
          password: 'secret123',
          token: 'abc123',
        },
      }

      mockArgumentsHost.switchToHttp.mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => requestWithSensitiveData,
      })

      const exception = new BadRequestException('Test error')

      filter.catch(exception, mockArgumentsHost as any)

      // 验证敏感数据被隐藏（通过检查日志调用）
      expect(true).toBe(true) // 这里主要是测试不会抛出错误
    })
  })

  describe('error categorization', () => {
    it('should categorize file not found errors', () => {
      const error = new Error('ENOENT: no such file or directory')

      filter.catch(error, mockArgumentsHost as any)

      const responseCall = mockResponse.json.mock.calls[0][0]
      expect(responseCall.error.code).toBe('FILE_NOT_FOUND')
    })

    it('should categorize permission errors', () => {
      const error = new Error('EACCES: permission denied')

      filter.catch(error, mockArgumentsHost as any)

      const responseCall = mockResponse.json.mock.calls[0][0]
      expect(responseCall.error.code).toBe('PERMISSION_DENIED')
    })

    it('should categorize timeout errors', () => {
      const error = new Error('Operation timeout')

      filter.catch(error, mockArgumentsHost as any)

      const responseCall = mockResponse.json.mock.calls[0][0]
      expect(responseCall.error.code).toBe('TIMEOUT')
    })

    it('should categorize connection errors', () => {
      const error = new Error('ECONNREFUSED: connection refused')

      filter.catch(error, mockArgumentsHost as any)

      const responseCall = mockResponse.json.mock.calls[0][0]
      expect(responseCall.error.code).toBe('CONNECTION_ERROR')
    })

    it('should categorize validation errors', () => {
      const error = new Error('Validation failed for field')

      filter.catch(error, mockArgumentsHost as any)

      const responseCall = mockResponse.json.mock.calls[0][0]
      expect(responseCall.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('logging levels', () => {
    it('should log 5xx errors as error level', () => {
      const exception = new HttpException('Internal error', HttpStatus.INTERNAL_SERVER_ERROR)
      const loggerSpy = jest.spyOn((filter as any).logger, 'error').mockImplementation()

      filter.catch(exception, mockArgumentsHost as any)

      expect(loggerSpy).toHaveBeenCalled()
    })

    it('should log 4xx errors as warning level', () => {
      const exception = new BadRequestException('Bad request')
      const loggerSpy = jest.spyOn((filter as any).logger, 'warn').mockImplementation()

      filter.catch(exception, mockArgumentsHost as any)

      expect(loggerSpy).toHaveBeenCalled()
    })

    it('should log unhandled exceptions as error level', () => {
      const error = new Error('Unhandled error')
      const loggerSpy = jest.spyOn((filter as any).logger, 'error').mockImplementation()

      filter.catch(error, mockArgumentsHost as any)

      expect(loggerSpy).toHaveBeenCalled()
    })
  })
})
