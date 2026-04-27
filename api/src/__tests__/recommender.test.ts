import { describe, expect, it } from 'vitest';
import { matchFixture, RecommendationSchema } from '../domain/recommender.js';
import type { Alert } from '../domain/simulator.js';

const buildAlert = (rule: string): Alert => ({
  id: 'a-1',
  assetId: 'TR-TEST-01',
  rule,
  severity: 'high',
  message: 'test',
  status: 'open',
  raisedAt: '2026-04-27T12:00:00.000Z',
});

describe('matchFixture', () => {
  it('returns the healthy fixture when no alert is provided', () => {
    const rec = matchFixture(null);
    expect(rec.urgency).toBe('low');
    expect(rec.source).toBe('fixture');
  });

  it('routes oil_temp_high alerts to the oil-temp-high fixture', () => {
    const rec = matchFixture(buildAlert('oil_temp_high'));
    expect(rec.urgency).toBe('high');
    expect(rec.root_cause.toLowerCase()).toContain('oil');
  });

  it('routes winding_fault alerts to the winding-fault fixture', () => {
    const rec = matchFixture(buildAlert('winding_fault'));
    expect(rec.urgency).toBe('critical');
  });

  it('routes dga_spike alerts to the dga-spike fixture', () => {
    const rec = matchFixture(buildAlert('dga_spike'));
    expect(rec.urgency).toBe('critical');
    expect(rec.root_cause.toLowerCase()).toContain('dga');
  });

  it('falls back to healthy fixture for unknown rules', () => {
    const rec = matchFixture(buildAlert('totally_unknown_rule'));
    expect(rec.urgency).toBe('low');
  });

  it('every fixture validates against the recommendation schema', () => {
    for (const rule of ['oil_temp_high', 'winding_fault', 'dga_spike', 'load_imbalance', 'unknown']) {
      const rec = matchFixture(buildAlert(rule));
      expect(() => RecommendationSchema.parse(rec)).not.toThrow();
    }
  });
});
