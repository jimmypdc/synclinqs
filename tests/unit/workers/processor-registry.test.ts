// Mock config before importing modules that depend on it
jest.mock('../../../src/config/index', () => ({
  config: {
    database: { url: 'postgresql://test:test@localhost:5432/test' },
    redis: { url: 'redis://localhost:6379' },
    jwt: { secret: 'test-secret', expiresIn: '1h', refreshExpiresIn: '7d' },
    encryption: { key: 'test-encryption-key-32-characters!' },
    email: { host: 'localhost', port: 587, secure: false, user: '', pass: '', from: 'test@test.com' },
    app: { name: 'SyncLinqs', env: 'test', port: 3000, apiVersion: 'v1', logLevel: 'info', corsOrigin: '*' },
  },
}));

// Mock the logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock prisma
jest.mock('../../../src/lib/prisma', () => ({
  prisma: {},
}));

import { getProcessor } from '../../../src/workers/processors/index';
import { sftpProcessor } from '../../../src/workers/processors/sftp.processor';
import { restApiProcessor } from '../../../src/workers/processors/rest-api.processor';
import { soapProcessor } from '../../../src/workers/processors/soap.processor';
import { webhookProcessor } from '../../../src/workers/processors/webhook.processor';
import { IntegrationType } from '../../../src/workers/types';

describe('Processor Registry', () => {
  describe('getProcessor', () => {
    it('should return SFTP processor for SFTP type', () => {
      const processor = getProcessor('SFTP');
      expect(processor).toBe(sftpProcessor);
    });

    it('should return REST API processor for REST_API type', () => {
      const processor = getProcessor('REST_API');
      expect(processor).toBe(restApiProcessor);
    });

    it('should return SOAP processor for SOAP type', () => {
      const processor = getProcessor('SOAP');
      expect(processor).toBe(soapProcessor);
    });

    it('should return Webhook processor for WEBHOOK type', () => {
      const processor = getProcessor('WEBHOOK');
      expect(processor).toBe(webhookProcessor);
    });

    it('should throw error for unknown integration type', () => {
      expect(() => getProcessor('UNKNOWN' as IntegrationType)).toThrow(
        'No processor registered for integration type: UNKNOWN'
      );
    });

    it('should return processors with processSync method', () => {
      const types: IntegrationType[] = ['SFTP', 'REST_API', 'SOAP', 'WEBHOOK'];

      types.forEach((type) => {
        const processor = getProcessor(type);
        expect(processor).toHaveProperty('processSync');
        expect(typeof processor.processSync).toBe('function');
      });
    });
  });
});
