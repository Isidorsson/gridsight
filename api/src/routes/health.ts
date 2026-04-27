import { Router } from 'express';
import { db } from '../lib/db.js';
import { liveLLMEnabled } from '../lib/env.js';

export const healthRouter = Router();

healthRouter.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

healthRouter.get('/readyz', (_req, res) => {
  try {
    const row = db.prepare('SELECT 1 AS ok').get() as { ok: number };
    res.json({
      status: 'ok',
      db: row.ok === 1 ? 'ok' : 'fail',
      llm: liveLLMEnabled ? 'live' : 'fixture',
    });
  } catch (err) {
    res.status(503).json({ status: 'fail', error: (err as Error).message });
  }
});
