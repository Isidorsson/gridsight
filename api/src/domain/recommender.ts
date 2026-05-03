/**
 * Maintenance recommendation engine — env-gated dual path.
 *
 *   OPENROUTER_API_KEY set     → live LLM call via OpenRouter (model picked per-request)
 *   OPENROUTER_API_KEY missing → deterministic fixture lookup (the public-demo path)
 *
 * Both paths return the same shape. OpenRouter exposes an OpenAI-compatible REST API,
 * so we use the `openai` SDK with a custom baseURL and route between Anthropic and
 * OpenAI models behind a curated allowlist (no arbitrary model strings from clients).
 */

import OpenAI from 'openai';
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
  model: string | null;
  generated_at: string;
};

export interface ModelOption {
  id: string;
  label: string;
  vendor: 'anthropic' | 'openai';
  hint: string;
}

/**
 * Curated allowlist. Clients may only request these IDs — anything else is rejected
 * before it ever reaches OpenRouter, keeping cost and abuse surface bounded.
 * IDs follow OpenRouter's `<vendor>/<model>` namespace.
 */
export const MODEL_OPTIONS: ReadonlyArray<ModelOption> = [
  { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6', vendor: 'anthropic', hint: 'Fast · default' },
  { id: 'anthropic/claude-opus-4.7', label: 'Claude Opus 4.7', vendor: 'anthropic', hint: 'Deepest reasoning' },
  { id: 'openai/gpt-5.5', label: 'GPT-5.5', vendor: 'openai', hint: 'OpenAI flagship' },
  { id: 'openai/gpt-5.4-mini', label: 'GPT-5.4 mini', vendor: 'openai', hint: 'Cheap · fast' },
];

const MODEL_IDS = new Set(MODEL_OPTIONS.map((m) => m.id));

export function resolveModel(requested: string | undefined): string {
  if (requested && MODEL_IDS.has(requested)) return requested;
  if (MODEL_IDS.has(env.OPENROUTER_DEFAULT_MODEL)) return env.OPENROUTER_DEFAULT_MODEL;
  return MODEL_OPTIONS[0]!.id;
}

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
      model: null,
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

Return your answer by calling the emit_recommendation function exactly once.`;

const TOOL_SCHEMA = {
  type: 'function' as const,
  function: {
    name: 'emit_recommendation',
    description: 'Emit a structured maintenance recommendation.',
    parameters: {
      type: 'object',
      properties: {
        urgency: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        root_cause: { type: 'string' },
        recommended_actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              priority: { type: 'string', enum: ['now', 'soon', 'planned'] },
              action: { type: 'string' },
              rationale: { type: 'string' },
            },
            required: ['priority', 'action', 'rationale'],
            additionalProperties: false,
          },
          minItems: 1,
        },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        references: { type: 'array', items: { type: 'string' } },
      },
      required: ['urgency', 'root_cause', 'recommended_actions', 'confidence'],
      additionalProperties: false,
    },
  },
};

let openrouterClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (openrouterClient) return openrouterClient;
  if (!env.OPENROUTER_API_KEY) {
    throw new Error('OpenRouter client requested without OPENROUTER_API_KEY');
  }
  openrouterClient = new OpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: env.OPENROUTER_BASE_URL,
    defaultHeaders: {
      'HTTP-Referer': 'https://gridsight.app',
      'X-Title': 'GridSight',
    },
  });
  return openrouterClient;
}

async function callLLM(
  model: string,
  asset: TransformerAsset,
  alert: Alert | null,
  recentReadings: TelemetryReading[],
): Promise<Recommendation> {
  const client = getClient();

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

  const response = await client.chat.completions.create({
    model,
    max_tokens: 1024,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    tools: [TOOL_SCHEMA],
    tool_choice: { type: 'function', function: { name: 'emit_recommendation' } },
  });

  const choice = response.choices[0];
  const toolCall = choice?.message.tool_calls?.[0];
  if (!toolCall || toolCall.type !== 'function' || toolCall.function.name !== 'emit_recommendation') {
    throw new Error(`Model ${model} did not return the expected tool_call`);
  }

  let parsedArgs: unknown;
  try {
    parsedArgs = JSON.parse(toolCall.function.arguments);
  } catch (err) {
    throw new Error(`Model ${model} returned non-JSON tool arguments: ${(err as Error).message}`);
  }

  const validated = RecommendationSchema.parse(parsedArgs);
  recommendationsTotal.inc({ source: 'live' });
  return {
    ...validated,
    source: 'live',
    model,
    generated_at: new Date().toISOString(),
  };
}

export async function getRecommendation(
  asset: TransformerAsset,
  alert: Alert | null,
  recentReadings: TelemetryReading[],
  requestedModel?: string,
): Promise<Recommendation> {
  if (liveLLMEnabled) {
    const model = resolveModel(requestedModel);
    try {
      return await callLLM(model, asset, alert, recentReadings);
    } catch (err) {
      logger.warn({ err, assetId: asset.id, model }, 'live LLM call failed — falling back to fixture');
      return matchFixture(alert);
    }
  }
  return matchFixture(alert);
}
