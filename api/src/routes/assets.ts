import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { NotFound } from '../lib/errors.js';
import { getAsset, listAssets } from '../domain/assets.js';
import type { TelemetryReading } from '../domain/simulator.js';

export const assetsRouter = Router();

const TelemetryQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(1000).default(120),
});

interface TelemetryRow {
  asset_id: string;
  ts: string;
  oil_temp_c: number;
  winding_temp_c: number;
  ambient_temp_c: number;
  load_factor: number;
  voltage_pu: number;
  current_a: number;
  dga_h2_ppm: number;
  dga_ch4_ppm: number;
  dga_c2h2_ppm: number;
}

const rowToReading = (r: TelemetryRow): TelemetryReading => ({
  assetId: r.asset_id,
  ts: r.ts,
  oilTempC: r.oil_temp_c,
  windingTempC: r.winding_temp_c,
  ambientTempC: r.ambient_temp_c,
  loadFactor: r.load_factor,
  voltagePu: r.voltage_pu,
  currentA: r.current_a,
  dgaH2Ppm: r.dga_h2_ppm,
  dgaCh4Ppm: r.dga_ch4_ppm,
  dgaC2h2Ppm: r.dga_c2h2_ppm,
});

assetsRouter.get('/', (_req, res) => {
  res.json({ items: listAssets() });
});

assetsRouter.get('/:id', (req, res) => {
  const asset = getAsset(req.params.id);
  if (!asset) throw NotFound(`Asset ${req.params.id}`);
  res.json(asset);
});

assetsRouter.get('/:id/telemetry', (req, res) => {
  const asset = getAsset(req.params.id);
  if (!asset) throw NotFound(`Asset ${req.params.id}`);

  const query = TelemetryQuery.parse(req.query);
  const filters: string[] = ['asset_id = ?'];
  const params: (string | number)[] = [asset.id];

  if (query.from) {
    filters.push('ts >= ?');
    params.push(query.from);
  }
  if (query.to) {
    filters.push('ts <= ?');
    params.push(query.to);
  }

  const sql = `
    SELECT * FROM telemetry
    WHERE ${filters.join(' AND ')}
    ORDER BY ts DESC
    LIMIT ?
  `;
  params.push(query.limit);

  const rows = db.prepare(sql).all(...params) as TelemetryRow[];
  res.json({ items: rows.map(rowToReading).reverse() });
});
