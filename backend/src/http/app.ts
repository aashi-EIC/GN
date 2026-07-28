import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { config } from '../config/env.js';
import { logger } from '../observability/logger.js';
import { authenticate } from './middleware/authenticate.js';
import { cancellation } from './middleware/cancellation.js';
import { correlation } from './middleware/correlation.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { chatRouter } from './routes/chat.js';
import { healthRouter } from './routes/health.js';

export const app = express();
const allowedOrigins = config.CORS_ALLOWED_ORIGINS
  ?.split(',')
  .map((value) => value.trim())
  .filter(Boolean) ?? [];

app.disable('x-powered-by');
app.use(correlation);
app.use(pinoHttp({
  logger,
  genReqId: (req) => (req as typeof req & { correlationId?: string }).correlationId ?? 'unknown',
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
}));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: (origin, callback) => {
    callback(null, !origin || allowedOrigins.includes(origin));
  },
  credentials: false,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['authorization', 'content-type', 'x-correlation-id'],
}));
app.use(express.json({ limit: '256kb', strict: true }));
app.use(cancellation);
app.use('/api/v1/health', healthRouter);
app.use('/api/v1', authenticate, chatRouter);
app.use(notFound);
app.use(errorHandler);
