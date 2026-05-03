import { z } from 'zod';

const trimmed = (schema: z.ZodString) => z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), schema);

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  ),
  DATABASE_URL: trimmed(z.string().min(1)).default('./gridsight.db'),
  CORS_ORIGIN: trimmed(z.string().min(1)).default('http://localhost:4200'),
  OPENROUTER_API_KEY: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() || undefined : v),
    z.string().optional(),
  ),
  OPENROUTER_BASE_URL: trimmed(z.string().min(1)).default('https://openrouter.ai/api/v1'),
  OPENROUTER_DEFAULT_MODEL: trimmed(z.string().min(1)).default('anthropic/claude-sonnet-4.6'),
  ENERGY_CHARTS_BASE: trimmed(z.string().min(1)).default('https://api.energy-charts.info'),
  NODE_ENV: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z.enum(['development', 'production', 'test']).default('development'),
  ),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env: Env = parsed.data;
export const liveLLMEnabled = !!env.OPENROUTER_API_KEY;
