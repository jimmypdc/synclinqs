import winston from 'winston';
import { config } from '../config/index.js';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, requestId, ...metadata }) => {
  let log = `${timestamp} [${level}]`;
  if (requestId) {
    log += ` [${requestId}]`;
  }
  log += `: ${message}`;

  if (Object.keys(metadata).length > 0 && metadata.stack === undefined) {
    log += ` ${JSON.stringify(metadata)}`;
  }

  return log;
});

const logger = winston.createLogger({
  level: config.logLevel,
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), logFormat),
  defaultMeta: { service: config.appName },
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
  ],
});

if (config.nodeEnv === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
    })
  );
}

export { logger };
