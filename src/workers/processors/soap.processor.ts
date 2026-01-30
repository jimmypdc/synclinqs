import * as soap from 'soap';
import { ProcessorContext, TypeProcessor } from './base.processor.js';
import { SoapConfig } from '../types.js';
import { logger } from '../../utils/logger.js';

export class SoapProcessor implements TypeProcessor {
  async processSync(context: ProcessorContext): Promise<{ recordsProcessed: number }> {
    const config = context.config as SoapConfig;
    let recordsProcessed = 0;

    logger.info('SOAP sync started', {
      integrationId: context.integrationId,
      wsdlUrl: config.wsdlUrl,
      endpoint: config.endpoint,
    });

    try {
      // Create SOAP client from WSDL
      const clientOptions: soap.IOptions = {
        endpoint: config.endpoint,
        wsdl_options: {
          timeout: config.timeout ?? 30000,
        },
      };

      // Add WS-Security if configured
      if (config.username && config.password) {
        clientOptions.wsdl_options = {
          ...clientOptions.wsdl_options,
        };
      }

      const client = await soap.createClientAsync(config.wsdlUrl, clientOptions);

      // Set endpoint if different from WSDL
      if (config.endpoint) {
        client.setEndpoint(config.endpoint);
      }

      // Add security headers if configured
      if (config.username && config.password) {
        if (config.securityType === 'WSSecurity') {
          const wsSecurity = new soap.WSSecurity(
            config.username,
            config.password,
            {
              passwordType: config.passwordType ?? 'PasswordText',
              hasTimeStamp: config.hasTimestamp ?? true,
              hasNonce: config.hasNonce ?? true,
            }
          );
          client.setSecurity(wsSecurity);
        } else {
          // Basic Auth
          const basicAuth = new soap.BasicAuthSecurity(config.username, config.password);
          client.setSecurity(basicAuth);
        }
      }

      // Add custom SOAP headers if configured
      if (config.soapHeaders) {
        for (const header of config.soapHeaders) {
          client.addSoapHeader(header);
        }
      }

      // Execute configured operations
      const operations = config.operations ?? [];

      for (const operation of operations) {
        try {
          const result = await this.executeOperation(client, operation, config);
          recordsProcessed += result.count;
        } catch (opError) {
          logger.error('SOAP operation failed', {
            operation: operation.name,
            error: String(opError),
          });
          // Continue with other operations unless configured to stop
          if (config.stopOnError) {
            throw opError;
          }
        }
      }
    } catch (error) {
      logger.error('SOAP sync failed', {
        integrationId: context.integrationId,
        error: String(error),
      });
      throw error;
    }

    logger.info('SOAP sync completed', {
      integrationId: context.integrationId,
      recordsProcessed,
    });

    return { recordsProcessed };
  }

  private async executeOperation(
    client: soap.Client,
    operation: { name: string; params?: Record<string, unknown> },
    config: SoapConfig
  ): Promise<{ count: number; data: unknown }> {
    logger.info('Executing SOAP operation', { operation: operation.name });

    // Get the operation method from client
    const operationMethod = (client as unknown as Record<string, unknown>)[`${operation.name}Async`];

    if (typeof operationMethod !== 'function') {
      throw new Error(`SOAP operation not found: ${operation.name}`);
    }

    // Execute the operation
    const [result] = await (operationMethod as (params: Record<string, unknown>) => Promise<unknown[]>).call(
      client,
      operation.params ?? {}
    );

    // Parse the result
    let data: unknown[] = [];

    if (result && typeof result === 'object') {
      // Try to find array data in common response patterns
      const resultObj = result as Record<string, unknown>;

      if (Array.isArray(resultObj.items)) {
        data = resultObj.items;
      } else if (Array.isArray(resultObj.records)) {
        data = resultObj.records;
      } else if (Array.isArray(resultObj.data)) {
        data = resultObj.data;
      } else if (resultObj.result && Array.isArray(resultObj.result)) {
        data = resultObj.result;
      } else {
        // Single item response
        data = [result];
      }
    }

    logger.info('SOAP operation completed', {
      operation: operation.name,
      recordCount: data.length,
    });

    return { count: data.length, data };
  }
}

export const soapProcessor = new SoapProcessor();
