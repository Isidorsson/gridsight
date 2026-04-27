/**
 * SCADA-style telemetry simulator with anomaly detection.
 *
 * Threshold references (IEEE C57.91-2011 — Loading Guide for Mineral-Oil-Immersed Transformers):
 *   - Top-oil temperature limit (normal life expectancy)         : 105 °C
 *   - Hottest-spot winding temperature limit                     : 130 °C
 *   - Sustained loading > 1.0 pu accelerates insulation aging    : load factor warning
 *
 * DGA (dissolved gas analysis) thresholds follow IEEE C57.104-2019 condition 2/3 limits
 * for free-breathing mineral-oil transformers.
 */

import { randomUUID } from 'node:crypto';
import { db } from '../lib/db.js';
import { alertsRaisedTotal } from '../lib/metrics.js';
import { sseBus } from '../lib/sse.js';
import type { TransformerAsset } from './assets.js';

export interface TelemetryReading {
  assetId: string;
  ts: string;
  oilTempC: number;
  windingTempC: number;
  ambientTempC: number;
  loadFactor: number;
  voltagePu: number;
  currentA: number;
  dgaH2Ppm: number;
  dgaCh4Ppm: number;
  dgaC2h2Ppm: number;
}

export interface Alert {
  id: string;
  assetId: string;
  rule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  status: 'open' | 'ack' | 'resolved';
  raisedAt: string;
}

export const THRESHOLDS = {
  oilTempWarnC: 95,
  oilTempAlarmC: 105,
  windingTempWarnC: 110,
  windingTempAlarmC: 130,
  loadOverloadWarn: 1.0,
  loadOverloadCritical: 1.2,
  voltagePuLow: 0.95,
  voltagePuHigh: 1.05,
  dgaH2WarnPpm: 100,
  dgaH2AlarmPpm: 700,
  dgaCh4WarnPpm: 120,
  dgaC2h2AlarmPpm: 5,
} as const;

const HEALTHY_BASELINES = {
  oilTempC: { mean: 55, std: 4 },
  windingTempC: { mean: 65, std: 5 },
  ambientTempC: { mean: 12, std: 3 },
  loadFactor: { mean: 0.55, std: 0.12 },
  voltagePu: { mean: 1.0, std: 0.01 },
  currentA: { mean: 180, std: 20 },
  dgaH2Ppm: { mean: 18, std: 5 },
  dgaCh4Ppm: { mean: 12, std: 4 },
  dgaC2h2Ppm: { mean: 0.4, std: 0.2 },
};

type FaultMode =
  | 'healthy'
  | 'oil_temp_high'
  | 'load_imbalance'
  | 'winding_fault'
  | 'dga_spike';

interface AssetRuntimeState {
  faultMode: FaultMode;
  faultUntil: number;
  noiseSeed: number;
}

const runtimeStates = new Map<string, AssetRuntimeState>();

const gauss = (mean: number, std: number): number => {
  const u = Math.max(Number.EPSILON, Math.random());
  const v = Math.max(Number.EPSILON, Math.random());
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

function pickFaultMode(): FaultMode {
  const r = Math.random();
  if (r < 0.85) return 'healthy';
  if (r < 0.91) return 'oil_temp_high';
  if (r < 0.95) return 'load_imbalance';
  if (r < 0.98) return 'winding_fault';
  return 'dga_spike';
}

function getOrInitState(assetId: string): AssetRuntimeState {
  let state = runtimeStates.get(assetId);
  if (!state || Date.now() > state.faultUntil) {
    state = {
      faultMode: pickFaultMode(),
      faultUntil: Date.now() + (60 + Math.random() * 240) * 1000,
      noiseSeed: Math.random(),
    };
    runtimeStates.set(assetId, state);
  }
  return state;
}

export function generateReading(asset: TransformerAsset): TelemetryReading {
  const state = getOrInitState(asset.id);
  const b = HEALTHY_BASELINES;

  let reading: TelemetryReading = {
    assetId: asset.id,
    ts: new Date().toISOString(),
    oilTempC: gauss(b.oilTempC.mean, b.oilTempC.std),
    windingTempC: gauss(b.windingTempC.mean, b.windingTempC.std),
    ambientTempC: gauss(b.ambientTempC.mean, b.ambientTempC.std),
    loadFactor: gauss(b.loadFactor.mean, b.loadFactor.std),
    voltagePu: gauss(b.voltagePu.mean, b.voltagePu.std),
    currentA: gauss(b.currentA.mean, b.currentA.std),
    dgaH2Ppm: gauss(b.dgaH2Ppm.mean, b.dgaH2Ppm.std),
    dgaCh4Ppm: gauss(b.dgaCh4Ppm.mean, b.dgaCh4Ppm.std),
    dgaC2h2Ppm: Math.max(0, gauss(b.dgaC2h2Ppm.mean, b.dgaC2h2Ppm.std)),
  };

  switch (state.faultMode) {
    case 'oil_temp_high':
      reading = {
        ...reading,
        oilTempC: gauss(102, 3),
        loadFactor: gauss(0.92, 0.05),
      };
      break;
    case 'load_imbalance':
      reading = {
        ...reading,
        loadFactor: gauss(1.12, 0.04),
        currentA: gauss(280, 15),
        voltagePu: gauss(0.93, 0.01),
      };
      break;
    case 'winding_fault':
      reading = {
        ...reading,
        windingTempC: gauss(125, 4),
        oilTempC: gauss(88, 3),
      };
      break;
    case 'dga_spike':
      reading = {
        ...reading,
        dgaH2Ppm: gauss(820, 40),
        dgaCh4Ppm: gauss(180, 15),
        dgaC2h2Ppm: Math.max(0, gauss(7, 1)),
      };
      break;
  }

  reading.loadFactor = Math.max(0, reading.loadFactor);
  reading.voltagePu = Math.max(0, reading.voltagePu);
  return reading;
}

/**
 * Pure function: given a reading + asset, return any alerts that should be raised.
 * No side effects — keeps this trivially testable.
 */
export function detectAnomalies(reading: TelemetryReading): Omit<Alert, 'id' | 'status' | 'raisedAt'>[] {
  const out: Omit<Alert, 'id' | 'status' | 'raisedAt'>[] = [];
  const t = THRESHOLDS;

  if (reading.oilTempC >= t.oilTempAlarmC) {
    out.push({
      assetId: reading.assetId,
      rule: 'oil_temp_high',
      severity: 'high',
      message: `Top-oil temperature ${reading.oilTempC.toFixed(1)} °C exceeds IEEE C57.91 alarm threshold (${t.oilTempAlarmC} °C).`,
    });
  } else if (reading.oilTempC >= t.oilTempWarnC) {
    out.push({
      assetId: reading.assetId,
      rule: 'oil_temp_warn',
      severity: 'medium',
      message: `Top-oil temperature ${reading.oilTempC.toFixed(1)} °C above warning threshold (${t.oilTempWarnC} °C).`,
    });
  }

  if (reading.windingTempC >= t.windingTempAlarmC) {
    out.push({
      assetId: reading.assetId,
      rule: 'winding_fault',
      severity: 'critical',
      message: `Hottest-spot winding temperature ${reading.windingTempC.toFixed(1)} °C exceeds IEEE C57.91 alarm (${t.windingTempAlarmC} °C). Insulation aging accelerated.`,
    });
  } else if (reading.windingTempC >= t.windingTempWarnC) {
    out.push({
      assetId: reading.assetId,
      rule: 'winding_temp_warn',
      severity: 'medium',
      message: `Winding temperature ${reading.windingTempC.toFixed(1)} °C approaching limit.`,
    });
  }

  if (reading.loadFactor >= t.loadOverloadCritical) {
    out.push({
      assetId: reading.assetId,
      rule: 'load_imbalance',
      severity: 'high',
      message: `Load factor ${(reading.loadFactor * 100).toFixed(0)}% sustains overload above ${(t.loadOverloadCritical * 100).toFixed(0)}%.`,
    });
  } else if (reading.loadFactor >= t.loadOverloadWarn) {
    out.push({
      assetId: reading.assetId,
      rule: 'load_overload_warn',
      severity: 'medium',
      message: `Load factor ${(reading.loadFactor * 100).toFixed(0)}% at or above rated capacity.`,
    });
  }

  if (reading.voltagePu < t.voltagePuLow || reading.voltagePu > t.voltagePuHigh) {
    out.push({
      assetId: reading.assetId,
      rule: 'voltage_excursion',
      severity: 'low',
      message: `Voltage ${reading.voltagePu.toFixed(3)} pu outside [${t.voltagePuLow}, ${t.voltagePuHigh}] band.`,
    });
  }

  if (reading.dgaH2Ppm >= t.dgaH2AlarmPpm || reading.dgaC2h2Ppm >= t.dgaC2h2AlarmPpm) {
    out.push({
      assetId: reading.assetId,
      rule: 'dga_spike',
      severity: 'critical',
      message: `DGA condition 3: H₂=${reading.dgaH2Ppm.toFixed(0)} ppm, C₂H₂=${reading.dgaC2h2Ppm.toFixed(2)} ppm. Possible incipient fault — sample for laboratory analysis.`,
    });
  } else if (reading.dgaH2Ppm >= t.dgaH2WarnPpm || reading.dgaCh4Ppm >= t.dgaCh4WarnPpm) {
    out.push({
      assetId: reading.assetId,
      rule: 'dga_warn',
      severity: 'medium',
      message: `DGA condition 2: elevated dissolved gases (H₂=${reading.dgaH2Ppm.toFixed(0)}, CH₄=${reading.dgaCh4Ppm.toFixed(0)} ppm). Monitor trend.`,
    });
  }

  return out;
}

const insertTelemetry = db.prepare(`
  INSERT INTO telemetry (
    asset_id, ts, oil_temp_c, winding_temp_c, ambient_temp_c, load_factor,
    voltage_pu, current_a, dga_h2_ppm, dga_ch4_ppm, dga_c2h2_ppm
  ) VALUES (
    @assetId, @ts, @oilTempC, @windingTempC, @ambientTempC, @loadFactor,
    @voltagePu, @currentA, @dgaH2Ppm, @dgaCh4Ppm, @dgaC2h2Ppm
  )
`);

const insertAlert = db.prepare(`
  INSERT INTO alerts (id, asset_id, rule, severity, message, status, raised_at)
  VALUES (@id, @assetId, @rule, @severity, @message, 'open', @raisedAt)
`);

const findOpenAlertWithRule = db.prepare(`
  SELECT id FROM alerts WHERE asset_id = ? AND rule = ? AND status = 'open' LIMIT 1
`);

export function persistReading(reading: TelemetryReading): void {
  insertTelemetry.run(reading);
}

export function persistAlerts(reading: TelemetryReading): Alert[] {
  const created: Alert[] = [];
  const candidates = detectAnomalies(reading);

  for (const c of candidates) {
    const existing = findOpenAlertWithRule.get(c.assetId, c.rule);
    if (existing) continue;

    const alert: Alert = {
      ...c,
      id: randomUUID(),
      status: 'open',
      raisedAt: new Date().toISOString(),
    };
    insertAlert.run(alert);
    alertsRaisedTotal.inc({ severity: alert.severity, rule: alert.rule });
    created.push(alert);
  }

  return created;
}

let simulatorTimer: NodeJS.Timeout | null = null;

export function startSimulator(getAssets: () => TransformerAsset[], tickMs = 5000): void {
  if (simulatorTimer) return;
  simulatorTimer = setInterval(() => {
    for (const asset of getAssets()) {
      const reading = generateReading(asset);
      persistReading(reading);
      sseBus.publish({ event: 'telemetry', data: reading });

      const alerts = persistAlerts(reading);
      for (const a of alerts) {
        sseBus.publish({ event: 'alert', data: a });
      }
    }
  }, tickMs);
}

export function stopSimulator(): void {
  if (simulatorTimer) {
    clearInterval(simulatorTimer);
    simulatorTimer = null;
  }
}
