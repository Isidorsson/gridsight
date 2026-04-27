import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { BadRequest, NotFound } from '../lib/errors.js';

export const alertsRouter = Router();

const AlertsQuery = z.object({
  status: z.enum(['open', 'ack', 'resolved', 'all']).default('open'),
  asset_id: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
});

const AckBody = z.object({
  user: z.string().min(1).max(100),
});

interface AlertRow {
  id: string;
  asset_id: string;
  rule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  status: 'open' | 'ack' | 'resolved';
  raised_at: string;
  acked_at: string | null;
  ack_user: string | null;
  resolved_at: string | null;
}

const rowToAlert = (r: AlertRow) => ({
  id: r.id,
  assetId: r.asset_id,
  rule: r.rule,
  severity: r.severity,
  message: r.message,
  status: r.status,
  raisedAt: r.raised_at,
  ackedAt: r.acked_at,
  ackUser: r.ack_user,
  resolvedAt: r.resolved_at,
});

alertsRouter.get('/', (req, res) => {
  const q = AlertsQuery.parse(req.query);
  const filters: string[] = [];
  const params: (string | number)[] = [];

  if (q.status !== 'all') {
    filters.push('status = ?');
    params.push(q.status);
  }
  if (q.asset_id) {
    filters.push('asset_id = ?');
    params.push(q.asset_id);
  }

  const sql = `
    SELECT * FROM alerts
    ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
    ORDER BY raised_at DESC
    LIMIT ?
  `;
  params.push(q.limit);

  const rows = db.prepare(sql).all(...params) as AlertRow[];
  res.json({ items: rows.map(rowToAlert) });
});

alertsRouter.post('/:id/ack', (req, res) => {
  const body = AckBody.parse(req.body);
  const existing = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id) as AlertRow | undefined;
  if (!existing) throw NotFound(`Alert ${req.params.id}`);
  if (existing.status !== 'open') {
    throw BadRequest(`Alert is already ${existing.status}`);
  }

  const now = new Date().toISOString();
  db.prepare(
    'UPDATE alerts SET status = ?, acked_at = ?, ack_user = ? WHERE id = ?',
  ).run('ack', now, body.user, req.params.id);

  const updated = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id) as AlertRow;
  res.json(rowToAlert(updated));
});
