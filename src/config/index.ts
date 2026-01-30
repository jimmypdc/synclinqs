import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
  appName: z.string().default('SyncLinqs'),
  apiVersion: z.string().default('v1'),
  port: z.coerce.number().default(3000),
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  database: z.object({
    url: z.string(),
  }),

  redis: z.object({
    url: z.string(),
  }),

  jwt: z.object({
    secret: z.string().min(32),
    expiresIn: z.string().default('15m'),
    refreshExpiresIn: z.string().default('7d'),
  }),

  encryption: z.object({
    key: z.string().min(32),
  }),

  rateLimit: z.object({
    windowMs: z.coerce.number().default(900000),
    maxRequests: z.coerce.number().default(100),
  }),

  cors: z.object({
    origin: z.string().default('http://localhost:3000'),
  }),
});

type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const result = configSchema.safeParse({
    nodeEnv: process.env.NODE_ENV,
    appName: process.env.APP_NAME,
    apiVersion: process.env.API_VERSION,
    port: process.env.PORT,
    logLevel: process.env.LOG_LEVEL,

    database: {
      url: process.env.DATABASE_URL,
    },

    redis: {
      url: process.env.REDIS_URL,
    },

    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN,
      refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN,
    },

    encryption: {
      key: process.env.ENCRYPTION_KEY,
    },

    rateLimit: {
      windowMs: process.env.RATE_LIMIT_WINDOW_MS,
      maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
    },

    cors: {
      origin: process.env.CORS_ORIGIN,
    },
  });

  if (!result.success) {
    console.error('Configuration validation failed:');
    console.error(result.error.format());
    throw new Error('Invalid configuration');
  }

  return result.data;
}

export const config = loadConfig();
export type { Config };
