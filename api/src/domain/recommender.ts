/**
 * Maintenance recommendation engine — env-gated dual path.
 *
 *   ANTHROPIC_API_KEY set     → live Claude call with tool-use schema enforcement
 *   ANTHROPIC_API_KEY missing → deterministic fixture lookup (the public-demo path)
 *
 * Both paths return the same shape. The portfolio narrative is: real integration
 * lives in the repo and runs locally; the public demo never holds the API key.
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { env, liveLLMEnabled } from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { recommendationsTotal } from '../lib/metrics.js';
import type { TransformerAsset } from './assets.js';
import type { Alert, TelemetryReading } from './simulator.js';

export const RecommendationSchema = z.object({
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
  root_cause: z.string().min(1),
  recommended_actions: z
    .array(
      z.object({
        priority: z.enum(['now', 'soon', 'planned']),
        action: z.string().min(1),
        rationale: z.string().min(1),
      }),
    )
    .min(1),
  confidence: z.number().min(0).max(1),
  references: z.array(z.string()).default([]),
});

export type Recommendation = z.infer<typeof RecommendationSchema> & {
  source: 'live' | 'fixture';
  generated_at: string;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures', 'recommendations');

const ALERT_RULE_TO_FIXTURE: Record<string, string> = {
  oil_temp_high: 'oil-temp-high',
  oil_temp_warn: 'oil-temp-high',
  winding_fault: 'winding-fault',
  winding_temp_warn: 'winding-fault',
  load_imbalance: 'load-imbalance',
  load_overload_warn: 'load-imbalance',
  dga_spike: 'dga-spike',
  dga_warn: 'dga-spike',
  voltage_excursion: 'load-imbalance',
};

let fixtureCache: Map<string, Recommendation> | null = null;

function loadFixtures(): Map<string, Recommendation> {
  if (fixtureCache) return fixtureCache;
  const cache = new Map<string, Recommendation>();
  const files = readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const raw = readFileSync(join(fixturesDir, file), 'utf8');
    const parsed = RecommendationSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      logger.warn({ file, errors: parsed.error.flatten() }, 'invalid fixture — skipped');
      continue;
    }
    const key = file.replace(/\.json$/, '');
    cache.set(key, {
      ...parsed.data,
      source: 'fixture',
      generated_at: new Date().toISOString(),
    });
  }
  fixtureCache = cache;
  return cache;
}

export function matchFixture(alert: Alert | null): Recommendation {
  const cache = loadFixtures();
  const key = alert ? ALERT_RULE_TO_FIXTURE[alert.rule] ?? 'healthy' : 'healthy';
  const found = cache.get(key) ?? cache.get('healthy');
  if (!found) {
    throw new Error('No fixtures available — ensure fixtures/recommendations/ has at least healthy.json');
  }
  recommendationsTotal.inc({ source: 'fixture' });
  return { ...found, generated_at: new Date().toISOString() };
}

const SYSTEM_PROMPT = `You are a maintenance planning assistant for a distribution-grid asset operator.
You receive structured telemetry from a transformer and (optionally) a triggered alert.
You produce a single, actionable recommendation that a field maintenance planner could
hand to a crew. You cite the relevant condition (oil temperature, winding, DGA, load) by
name. You do not invent measurements not present in the input. You do not recommend
replacement unless DGA condition 3 (per IEEE C57.104) is observed or sustained alarms
are present.

Return your answer by calling the emit_recommendation tool exactly once.`;

const TOOL_SCHEMA = {
  name: 'emit_recommendation',
  description: 'Emit a structured maintenance recommendation.',
  input_schema: {
    type: 'object' as const,
    properties: {
      urgency: { type: 'string' as const, enum: ['low', 'medium', 'high', 'critical'] },
      root_cause: { type: 'string' as const },
      recommended_actions: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            priority: { type: 'string' as const, enum: ['now', 'soon', 'planned'] },
            action: { type: 'string' as const },
            rationale: { type: 'string' as const },
          },
          required: ['priority', 'action', 'rationale'],
        },
        minItems: 1,
      },
      confidence: { type: 'number' as const, minimum: 0, maximum: 1 },
      references: { type: 'array' as const, items: { type: 'string' as const } },
    },
    required: ['urgency', 'root_cause', 'recommended_actions', 'confidence'],
  },
};

let anthropicClient: Anthropic | null = null;

async function callClaude(
  asset: TransformerAsset,
  alert: Alert | null,
  recentReadings: TelemetryReading[],
): Promise<Recommendation> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('callClaude invoked without ANTHROPIC_API_KEY');
  }
  anthropicClient ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const userMessage = JSON.stringify(
    {
      asset: {
        id: asset.id,
        name: asset.name,
        type: asset.assetType,
        rated_power_kva: asset.ratedPowerKva,
        primary_voltage_kv: asset.primaryVoltageKv,
        oil_type: asset.oilType,
        install_year: asset.installYear,
        cooling_class: asset.coolingClass,
      },
      alert: alert ? { rule: alert.rule, severity: alert.severity, message: alert.message } : null,
      recent_telemetry: recentReadings.slice(-10),
    },
    null,
    2,
  );

  const response = await anthropicClient.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [TOOL_SCHEMA],
    tool_choice: { type: 'tool', name: 'emit_recommendation' },
    messages: [{ role: 'user', content: userMessage }],
  });

  const toolUse = response.content.find((c) => c.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not return tool_use block');
  }

  const validated = RecommendationSchema.parse(toolUse.input);
  recommendationsTotal.inc({ source: 'live' });
  return { ...validated, source: 'live', generated_at: new Date().toISOString() };
}

export async function getRecommendation(
  asset: TransformerAsset,
  alert: Alert | null,
  recentReadings: TelemetryReading[],
): Promise<Recommendation> {
  if (liveLLMEnabled) {
    try {
      return await callClaude(asset, alert, recentReadings);
    } catch (err) {
      logger.warn({ err, assetId: asset.id }, 'live LLM call failed — falling back to fixture');
      return matchFixture(alert);
    }
  }
  return matchFixture(alert);
}
