import {
  QUEUE_CONFIGS,
  getQueueNameForType,
  IntegrationType,
  QueueName,
} from '../../../src/workers/types';

describe('Worker Types', () => {
  describe('QUEUE_CONFIGS', () => {
    it('should have configuration for all integration types', () => {
      const integrationTypes: IntegrationType[] = ['SFTP', 'REST_API', 'SOAP', 'WEBHOOK'];

      integrationTypes.forEach((type) => {
        expect(QUEUE_CONFIGS[type]).toBeDefined();
        expect(QUEUE_CONFIGS[type].name).toBeDefined();
        expect(QUEUE_CONFIGS[type].concurrency).toBeGreaterThan(0);
        expect(QUEUE_CONFIGS[type].timeoutMs).toBeGreaterThan(0);
        expect(QUEUE_CONFIGS[type].maxRetries).toBeGreaterThanOrEqual(0);
        expect(QUEUE_CONFIGS[type].backoffBaseMs).toBeGreaterThan(0);
      });
    });

    it('should have unique queue names for each type', () => {
      const queueNames = Object.values(QUEUE_CONFIGS).map((c) => c.name);
      const uniqueNames = new Set(queueNames);
      expect(uniqueNames.size).toBe(queueNames.length);
    });

    it('should have SFTP config with lower concurrency (I/O bound)', () => {
      expect(QUEUE_CONFIGS.SFTP.concurrency).toBeLessThanOrEqual(3);
      expect(QUEUE_CONFIGS.SFTP.timeoutMs).toBeGreaterThanOrEqual(10 * 60 * 1000); // At least 10 min
    });

    it('should have REST_API config with higher concurrency', () => {
      expect(QUEUE_CONFIGS.REST_API.concurrency).toBeGreaterThan(QUEUE_CONFIGS.SFTP.concurrency);
    });

    it('should have WEBHOOK config with short timeout', () => {
      expect(QUEUE_CONFIGS.WEBHOOK.timeoutMs).toBeLessThanOrEqual(5 * 60 * 1000); // Max 5 min
    });
  });

  describe('getQueueNameForType', () => {
    it('should return correct queue name for SFTP', () => {
      expect(getQueueNameForType('SFTP')).toBe('sync-sftp');
    });

    it('should return correct queue name for REST_API', () => {
      expect(getQueueNameForType('REST_API')).toBe('sync-rest-api');
    });

    it('should return correct queue name for SOAP', () => {
      expect(getQueueNameForType('SOAP')).toBe('sync-soap');
    });

    it('should return correct queue name for WEBHOOK', () => {
      expect(getQueueNameForType('WEBHOOK')).toBe('sync-webhook');
    });

    it('should return queue name matching the config', () => {
      const types: IntegrationType[] = ['SFTP', 'REST_API', 'SOAP', 'WEBHOOK'];

      types.forEach((type) => {
        const queueName = getQueueNameForType(type);
        expect(queueName).toBe(QUEUE_CONFIGS[type].name);
      });
    });
  });
});
