import { TypeProcessor } from './base.processor.js';
import { IntegrationType } from '../types.js';
import { sftpProcessor } from './sftp.processor.js';
import { restApiProcessor } from './rest-api.processor.js';
import { soapProcessor } from './soap.processor.js';
import { webhookProcessor } from './webhook.processor.js';

export { processJob, ProcessorContext, TypeProcessor } from './base.processor.js';

const processorRegistry: Record<IntegrationType, TypeProcessor> = {
  SFTP: sftpProcessor,
  REST_API: restApiProcessor,
  SOAP: soapProcessor,
  WEBHOOK: webhookProcessor,
};

export function getProcessor(type: IntegrationType): TypeProcessor {
  const processor = processorRegistry[type];
  if (!processor) {
    throw new Error(`No processor registered for integration type: ${type}`);
  }
  return processor;
}

export { sftpProcessor, restApiProcessor, soapProcessor, webhookProcessor };
