import pino from 'pino';
import { config } from '../config/env.js';

export const logger = pino({
  level: config.LOG_LEVEL,
  base: null,
  redact: {
    paths: ['req.headers.authorization', 'authorization', '*.accessToken', '*.rawAccessToken', '*.apiKey', '*.clientSecret', 'password'],
    censor: '[REDACTED]'
  },
  timestamp: pino.stdTimeFunctions.isoTime
});
