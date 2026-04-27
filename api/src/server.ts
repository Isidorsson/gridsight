import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listAssets } from './domain/assets.js';
import { startSimulator, stopSimulator } from './domain/simulator.js';
import { closeDb } from './lib/db.js';
import { env } from './lib/env.js';
import { errorHandler, notFoundHandler } from './lib/errors.js';
import { logger } from './lib/logger.js';
import {
  httpRequestDurationSeconds,
  httpRequestsTotal,
  registry,
} from './lib/metrics.js';
import { sseBus } from './lib/sse.js';
import { alertsRouter } from './routes/alerts.js';
import { assetsRouter } from './routes/assets.js';
import { healthRouter } from './routes/health.js';
import { recommendationsRouter } from './routes/recommendations.js';
import { streamRouter } from './routes/stream.js';
import { seedDatabase } from './db/seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function buildApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  const corsOrigin = env.CORS_ORIGIN.trim() === '*'
    ? true
    : env.CORS_ORIGIN.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: corsOrigin,
      credentials: corsOrigin !== true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '64kb' }));

  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
      const route = req.route?.path ?? req.baseUrl + (req.path === '/' ? '' : req.path);
      const labels = {
        method: req.method,
        route: route || req.path,
        status: String(res.statusCode),
      };
      httpRequestsTotal.inc(labels);
      httpRequestDurationSeconds.observe(labels, durationSec);
    });
    next();
  });

  const apiLimiter = rateLimit({
    windowMs: 60_000,
    limit: 600,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req) => req.path === '/healthz' || req.path === '/readyz' || req.path === '/metrics' || req.path === '/v1/stream',
  });
  app.use(apiLimiter);

  app.use('/', healthRouter);

  app.get('/metrics', async (_req, res, next) => {
    try {
      res.set('Content-Type', registry.contentType);
      res.end(await registry.metrics());
    } catch (err) {
      next(err);
    }
  });

  const openapiPath = join(__dirname, 'openapi.yaml');
  let openapiYaml = '';
  try {
    openapiYaml = readFileSync(openapiPath, 'utf8');
  } catch {
    logger.warn('openapi.yaml not found — /openapi will return 404');
  }
  app.get('/openapi', (_req, res) => {
    if (!openapiYaml) {
      res.status(404).json({ error: 'not_found', message: 'spec missing' });
      return;
    }
    res.set('Content-Type', 'application/yaml').send(openapiYaml);
  });

  app.use('/v1/assets', assetsRouter);
  app.use('/v1/assets', recommendationsRouter);
  app.use('/v1/alerts', alertsRouter);
  app.use('/v1/stream', streamRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export async function start(): Promise<void> {
  seedDatabase();

  const app = buildApp();
  // Bind to '::' (IPv6 wildcard) — Railway's healthcheck originates over IPv6.
  // On Linux, '::' also accepts IPv4 connections via IPv4-mapped IPv6 addresses.
  const server = app.listen(env.PORT, '::', () => {
    logger.info(
      { port: env.PORT, host: '::', env: env.NODE_ENV, llm: env.ANTHROPIC_API_KEY ? 'live' : 'fixture' },
      'gridsight-api listening',
    );
  });

  startSimulator(listAssets);

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'shutdown initiated');
    stopSimulator();
    sseBus.closeAll();
    server.close((err) => {
      if (err) logger.error({ err }, 'error closing server');
      closeDb();
      process.exit(err ? 1 : 0);
    });
    setTimeout(() => {
      logger.warn('forced shutdown after 10s');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaughtException');
    shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'unhandledRejection');
    shutdown('unhandledRejection');
  });
}

// Entry point — always start. We're invoked via the Docker CMD or `npm start`.
console.log(`[boot] gridsight-api starting · node=${process.version} · pid=${process.pid}`);
console.log(`[boot] env.PORT=${process.env.PORT} env.NODE_ENV=${process.env.NODE_ENV} cwd=${process.cwd()}`);
start().catch((err) => {
  console.error('[boot] fatal startup error:', err);
  logger.fatal({ err }, 'failed to start');
  process.exit(1);
});
