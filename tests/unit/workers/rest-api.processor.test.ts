import axios from 'axios';
import { RestApiProcessor } from '../../../src/workers/processors/rest-api.processor';
import { ProcessorContext } from '../../../src/workers/processors/base.processor';
import { RestApiConfig } from '../../../src/workers/types';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    request: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  })),
  post: jest.fn(),
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('RestApiProcessor', () => {
  let processor: RestApiProcessor;
  let mockAxiosInstance: jest.Mocked<ReturnType<typeof axios.create>>;

  const baseContext: Omit<ProcessorContext, 'config'> = {
    integrationId: 'int-123',
    organizationId: 'org-456',
    integrationType: 'REST_API',
    triggeredBy: 'user-789',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new RestApiProcessor();

    mockAxiosInstance = {
      request: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    } as unknown as jest.Mocked<ReturnType<typeof axios.create>>;

    (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);
  });

  describe('processSync', () => {
    it('should process data from default endpoint', async () => {
      const config: RestApiConfig = {
        baseUrl: 'https://api.example.com',
        authType: 'bearer',
        accessToken: 'test-token',
      };

      mockAxiosInstance.request.mockResolvedValueOnce({
        data: [{ id: 1 }, { id: 2 }],
      });

      const result = await processor.processSync({
        ...baseContext,
        config,
      });

      expect(result.recordsProcessed).toBe(2);
      expect(axios.create).toHaveBeenCalled();
    });

    it('should handle paginated responses', async () => {
      const config: RestApiConfig = {
        baseUrl: 'https://api.example.com',
        authType: 'api_key',
        apiKey: 'test-key',
        pageSize: 2,
      };

      // First page
      mockAxiosInstance.request.mockResolvedValueOnce({
        data: { data: [{ id: 1 }, { id: 2 }], total: 3 },
      });
      // Second page
      mockAxiosInstance.request.mockResolvedValueOnce({
        data: { data: [{ id: 3 }], total: 3 },
      });

      const result = await processor.processSync({
        ...baseContext,
        config,
      });

      expect(result.recordsProcessed).toBe(3);
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple endpoints', async () => {
      const config: RestApiConfig = {
        baseUrl: 'https://api.example.com',
        authType: 'basic',
        username: 'user',
        password: 'pass',
        endpoints: [
          { path: '/employees', method: 'GET' },
          { path: '/contributions', method: 'GET' },
        ],
      };

      mockAxiosInstance.request.mockResolvedValueOnce({ data: [{ id: 1 }] });
      mockAxiosInstance.request.mockResolvedValueOnce({ data: [{ id: 2 }, { id: 3 }] });

      const result = await processor.processSync({
        ...baseContext,
        config,
      });

      expect(result.recordsProcessed).toBe(3);
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(2);
    });

    it('should configure bearer auth correctly', async () => {
      const config: RestApiConfig = {
        baseUrl: 'https://api.example.com',
        authType: 'bearer',
        accessToken: 'my-token',
      };

      mockAxiosInstance.request.mockResolvedValueOnce({ data: [] });

      await processor.processSync({ ...baseContext, config });

      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.example.com',
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        })
      );
    });

    it('should configure basic auth correctly', async () => {
      const config: RestApiConfig = {
        baseUrl: 'https://api.example.com',
        authType: 'basic',
        username: 'testuser',
        password: 'testpass',
      };

      mockAxiosInstance.request.mockResolvedValueOnce({ data: [] });

      await processor.processSync({ ...baseContext, config });

      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: {
            username: 'testuser',
            password: 'testpass',
          },
        })
      );
    });

    it('should configure API key auth correctly', async () => {
      const config: RestApiConfig = {
        baseUrl: 'https://api.example.com',
        authType: 'api_key',
        apiKey: 'secret-key',
        apiKeyHeader: 'X-Custom-Key',
      };

      mockAxiosInstance.request.mockResolvedValueOnce({ data: [] });

      await processor.processSync({ ...baseContext, config });

      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Key': 'secret-key',
          }),
        })
      );
    });

    it('should handle OAuth2 authentication', async () => {
      const config: RestApiConfig = {
        baseUrl: 'https://api.example.com',
        authType: 'oauth2',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        tokenUrl: 'https://auth.example.com/token',
        scope: 'read write',
      };

      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: { access_token: 'oauth-token' },
      });
      mockAxiosInstance.request.mockResolvedValueOnce({ data: [] });

      await processor.processSync({ ...baseContext, config });

      expect(axios.post).toHaveBeenCalledWith(
        'https://auth.example.com/token',
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );
    });

    it('should continue processing other endpoints on error', async () => {
      const config: RestApiConfig = {
        baseUrl: 'https://api.example.com',
        authType: 'bearer',
        accessToken: 'token',
        endpoints: [
          { path: '/failing', method: 'GET' },
          { path: '/working', method: 'GET' },
        ],
      };

      mockAxiosInstance.request.mockRejectedValueOnce(new Error('Network error'));
      mockAxiosInstance.request.mockResolvedValueOnce({ data: [{ id: 1 }] });

      const result = await processor.processSync({ ...baseContext, config });

      expect(result.recordsProcessed).toBe(1);
    });

    it('should handle different response formats', async () => {
      const config: RestApiConfig = {
        baseUrl: 'https://api.example.com',
        authType: 'bearer',
        accessToken: 'token',
        endpoints: [
          { path: '/format1', method: 'GET' },
          { path: '/format2', method: 'GET' },
          { path: '/format3', method: 'GET' },
        ],
      };

      // Array response
      mockAxiosInstance.request.mockResolvedValueOnce({
        data: [{ id: 1 }],
      });
      // Object with data array
      mockAxiosInstance.request.mockResolvedValueOnce({
        data: { data: [{ id: 2 }] },
      });
      // Object with results array
      mockAxiosInstance.request.mockResolvedValueOnce({
        data: { results: [{ id: 3 }] },
      });

      const result = await processor.processSync({ ...baseContext, config });

      expect(result.recordsProcessed).toBe(3);
    });
  });
});
