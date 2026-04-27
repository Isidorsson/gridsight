import { describe, expect, it } from 'vitest';
import { detectAnomalies, THRESHOLDS } from '../domain/simulator.js';
import type { TelemetryReading } from '../domain/simulator.js';

const baseReading = (overrides: Partial<TelemetryReading> = {}): TelemetryReading => ({
  assetId: 'TR-TEST-01',
  ts: '2026-04-27T12:00:00.000Z',
  oilTempC: 55,
  windingTempC: 65,
  ambientTempC: 12,
  loadFactor: 0.55,
  voltagePu: 1.0,
  currentA: 180,
  dgaH2Ppm: 18,
  dgaCh4Ppm: 12,
  dgaC2h2Ppm: 0.4,
  ...overrides,
});

describe('detectAnomalies', () => {
  it('returns no alerts for a healthy reading', () => {
    expect(detectAnomalies(baseReading())).toEqual([]);
  });

  it('raises high-severity oil_temp_high above the alarm threshold', () => {
    const alerts = detectAnomalies(baseReading({ oilTempC: THRESHOLDS.oilTempAlarmC + 1 }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.rule).toBe('oil_temp_high');
    expect(alerts[0]?.severity).toBe('high');
  });

  it('raises medium-severity oil_temp_warn between warn and alarm', () => {
    const alerts = detectAnomalies(baseReading({ oilTempC: THRESHOLDS.oilTempWarnC + 1 }));
    expect(alerts[0]?.rule).toBe('oil_temp_warn');
    expect(alerts[0]?.severity).toBe('medium');
  });

  it('raises critical winding_fault above the alarm threshold', () => {
    const alerts = detectAnomalies(
      baseReading({ windingTempC: THRESHOLDS.windingTempAlarmC + 1 }),
    );
    expect(alerts.some((a) => a.rule === 'winding_fault' && a.severity === 'critical')).toBe(true);
  });

  it('raises critical dga_spike when H₂ above alarm', () => {
    const alerts = detectAnomalies(
      baseReading({ dgaH2Ppm: THRESHOLDS.dgaH2AlarmPpm + 100 }),
    );
    expect(alerts.some((a) => a.rule === 'dga_spike' && a.severity === 'critical')).toBe(true);
  });

  it('raises critical dga_spike when C₂H₂ above alarm even if H₂ is normal', () => {
    const alerts = detectAnomalies(
      baseReading({ dgaC2h2Ppm: THRESHOLDS.dgaC2h2AlarmPpm + 1 }),
    );
    expect(alerts.some((a) => a.rule === 'dga_spike')).toBe(true);
  });

  it('raises voltage_excursion when voltage drifts outside the band', () => {
    const low = detectAnomalies(baseReading({ voltagePu: 0.92 }));
    const high = detectAnomalies(baseReading({ voltagePu: 1.08 }));
    expect(low.some((a) => a.rule === 'voltage_excursion')).toBe(true);
    expect(high.some((a) => a.rule === 'voltage_excursion')).toBe(true);
  });

  it('flags compound failure: overload + high oil temp produces multiple alerts', () => {
    const alerts = detectAnomalies(
      baseReading({
        oilTempC: 110,
        loadFactor: 1.25,
      }),
    );
    const rules = new Set(alerts.map((a) => a.rule));
    expect(rules).toContain('oil_temp_high');
    expect(rules).toContain('load_imbalance');
  });
});
