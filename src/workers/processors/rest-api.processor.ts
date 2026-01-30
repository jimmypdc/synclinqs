import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ProcessorContext, TypeProcessor } from './base.processor.js';
import { RestApiConfig } from '../types.js';
import { logger } from '../../utils/logger.js';

export class RestApiProcessor implements TypeProcessor {
  private client: AxiosInstance | null = null;

  async processSync(context: ProcessorContext): Promise<{ recordsProcessed: number }> {
    const config = context.config as RestApiConfig;
    let recordsProcessed = 0;

    logger.info('REST API sync started', {
      integrationId: context.integrationId,
      baseUrl: config.baseUrl,
      authType: config.authType,
    });

    try {
      // Create axios client with auth
      this.client = await this.createClient(config);

      // Fetch data from configured endpoints
      const endpoints = config.endpoints ?? [{ path: '/data', method: 'GET' }];

      for (const endpoint of endpoints) {
        try {
          const result = await this.fetchEndpoint(endpoint, config);
          recordsProcessed += result.count;
        } catch (endpointError) {
          logger.error('Error fetching endpoint', {
            endpoint: endpoint.path,
            error: String(endpointError),
          });
          // Continue with other endpoints
        }
      }

      // Push any pending changes if configured
      if (config.pushEndpoint) {
        await this.pushPendingChanges(config);
      }
    } finally {
      this.client = null;
    }

    logger.info('REST API sync completed', {
      integrationId: context.integrationId,
      recordsProcessed,
    });

    return { recordsProcessed };
  }

  private async createClient(config: RestApiConfig): Promise<AxiosInstance> {
    const axiosConfig: AxiosRequestConfig = {
      baseURL: config.baseUrl,
      timeout: config.timeout ?? 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...config.headers,
      },
    };

    // Add authentication
    switch (config.authType) {
      case 'bearer':
        if (config.accessToken) {
          axiosConfig.headers = {
            ...axiosConfig.headers,
            Authorization: `Bearer ${config.accessToken}`,
          };
        }
        break;

      case 'basic':
        if (config.username && config.password) {
          axiosConfig.auth = {
            username: config.username,
            password: config.password,
          };
        }
        break;

      case 'api_key':
        if (config.apiKey) {
          const headerName = config.apiKeyHeader ?? 'X-API-Key';
          axiosConfig.headers = {
            ...axiosConfig.headers,
            [headerName]: config.apiKey,
          };
        }
        break;

      case 'oauth2':
        // Get OAuth2 token if credentials provided
        if (config.clientId && config.clientSecret && config.tokenUrl) {
          const token = await this.getOAuth2Token(config);
          axiosConfig.headers = {
            ...axiosConfig.headers,
            Authorization: `Bearer ${token}`,
          };
        }
        break;
    }

    const client = axios.create(axiosConfig);

    // Add request/response interceptors for logging
    client.interceptors.request.use((request) => {
      logger.debug('REST API request', {
        method: request.method,
        url: request.url,
      });
      return request;
    });

    client.interceptors.response.use(
      (response) => {
        logger.debug('REST API response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error('REST API error', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message,
        });
        throw error;
      }
    );

    return client;
  }

  private async getOAuth2Token(config: RestApiConfig): Promise<string> {
    const response = await axios.post(
      config.tokenUrl!,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId!,
        client_secret: config.clientSecret!,
        scope: config.scope ?? '',
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    return response.data.access_token;
  }

  private async fetchEndpoint(
    endpoint: { path: string; method?: string; params?: Record<string, string> },
    config: RestApiConfig
  ): Promise<{ count: number; data: unknown[] }> {
    if (!this.client) throw new Error('Client not initialized');

    const allData: unknown[] = [];
    let page = 1;
    const pageSize = config.pageSize ?? 100;
    let hasMore = true;

    while (hasMore) {
      const params = {
        ...endpoint.params,
        page,
        limit: pageSize,
        ...(config.paginationParams ?? {}),
      };

      const response = await this.client.request({
        method: (endpoint.method ?? 'GET') as 'GET' | 'POST',
        url: endpoint.path,
        params: endpoint.method === 'GET' ? params : undefined,
        data: endpoint.method === 'POST' ? params : undefined,
      });

      // Handle different response formats
      let data: unknown[] = [];
      let total: number | undefined;

      if (Array.isArray(response.data)) {
        data = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        data = response.data.data;
        total = response.data.total ?? response.data.pagination?.total;
      } else if (response.data?.results && Array.isArray(response.data.results)) {
        data = response.data.results;
        total = response.data.count ?? response.data.total;
      }

      allData.push(...data);

      logger.info('Fetched page', {
        endpoint: endpoint.path,
        page,
        pageCount: data.length,
        totalSoFar: allData.length,
      });

      // Check if there's more data
      if (data.length < pageSize) {
        hasMore = false;
      } else if (total !== undefined && allData.length >= total) {
        hasMore = false;
      } else {
        page++;
        // Rate limiting - wait between pages
        await this.delay(config.rateLimitMs ?? 100);
      }

      // Safety limit
      if (page > 1000) {
        logger.warn('Reached pagination safety limit', { endpoint: endpoint.path });
        hasMore = false;
      }
    }

    return { count: allData.length, data: allData };
  }

  private async pushPendingChanges(config: RestApiConfig): Promise<void> {
    if (!this.client || !config.pushEndpoint) return;

    // In a real implementation, you would:
    // 1. Query for pending changes from the database
    // 2. Transform data to the API format
    // 3. POST/PUT to the push endpoint
    // 4. Mark records as synced

    logger.info('Pushing pending changes', { endpoint: config.pushEndpoint });

    // Placeholder - actual implementation would depend on business requirements
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const restApiProcessor = new RestApiProcessor();
