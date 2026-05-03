import { Router } from 'express';
import { db } from '../lib/db.js';
import { NotFound } from '../lib/errors.js';
import { getAsset } from '../domain/assets.js';
import { getRecommendation, MODEL_OPTIONS } from '../domain/recommender.js';
import { liveLLMEnabled } from '../lib/env.js';
import type { TelemetryReading, Alert } from '../domain/simulator.js';

export const recommendationsRouter = Router({ mergeParams: true });
export const llmRouter = Router();

llmRouter.get('/models', (_req, res) => {
  res.json({ items: MODEL_OPTIONS, live: liveLLMEnabled });
});

interface AlertRow {
  id: string;
  asset_id: string;
  rule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  status: 'open' | 'ack' | 'resolved';
  raised_at: string;
}

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

recommendationsRouter.post('/:id/recommendations', async (req, res) => {
  const asset = getAsset(req.params.id);
  if (!asset) throw NotFound(`Asset ${req.params.id}`);

  const alertRow = db
    .prepare(
      "SELECT * FROM alerts WHERE asset_id = ? AND status = 'open' ORDER BY raised_at DESC LIMIT 1",
    )
    .get(asset.id) as AlertRow | undefined;

  const alert: Alert | null = alertRow
    ? {
        id: alertRow.id,
        assetId: alertRow.asset_id,
        rule: alertRow.rule,
        severity: alertRow.severity,
        message: alertRow.message,
        status: alertRow.status,
        raisedAt: alertRow.raised_at,
      }
    : null;

  const recentRows = db
    .prepare(
      'SELECT * FROM telemetry WHERE asset_id = ? ORDER BY ts DESC LIMIT 10',
    )
    .all(asset.id) as TelemetryRow[];

  const recentReadings: TelemetryReading[] = recentRows.map((r) => ({
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
  }));

  const requestedModel =
    typeof req.query.model === 'string' && req.query.model.length > 0 ? req.query.model : undefined;

  const recommendation = await getRecommendation(asset, alert, recentReadings, requestedModel);

  db.prepare(
    `INSERT INTO recommendations_cache (asset_id, alert_id, source, payload_json)
     VALUES (?, ?, ?, ?)`,
  ).run(asset.id, alert?.id ?? null, recommendation.source, JSON.stringify(recommendation));

  res.json(recommendation);
});
