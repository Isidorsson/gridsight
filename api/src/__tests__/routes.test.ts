import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../server.js';
import { seedDatabase } from '../db/seed.js';

let app: ReturnType<typeof buildApp>;

beforeAll(() => {
  seedDatabase();
  app = buildApp();
});

describe('routes', () => {
  it('GET /healthz returns 200', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /readyz returns DB status', async () => {
    const res = await request(app).get('/readyz');
    expect(res.status).toBe(200);
    expect(res.body.db).toBe('ok');
  });

  it('GET /metrics exposes prometheus format', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('# HELP');
  });

  it('GET /v1/assets returns the seed fleet', async () => {
    const res = await request(app).get('/v1/assets');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('GET /v1/assets/:id returns 404 for unknown id', async () => {
    const res = await request(app).get('/v1/assets/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('GET /v1/assets/:id returns the asset', async () => {
    const list = await request(app).get('/v1/assets');
    const id = list.body.items[0].id;
    const res = await request(app).get(`/v1/assets/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  it('POST /v1/assets/:id/recommendations returns a fixture in test env', async () => {
    const list = await request(app).get('/v1/assets');
    const id = list.body.items[0].id;
    const res = await request(app).post(`/v1/assets/${id}/recommendations`);
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('fixture');
    expect(res.body.model).toBeNull();
    expect(['low', 'medium', 'high', 'critical']).toContain(res.body.urgency);
  });

  it('GET /v1/llm/models returns the curated allowlist', async () => {
    const res = await request(app).get('/v1/llm/models');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(typeof res.body.live).toBe('boolean');
    expect(res.body.items[0]).toHaveProperty('id');
    expect(res.body.items[0]).toHaveProperty('vendor');
  });

  it('GET /v1/alerts accepts status filter', async () => {
    const res = await request(app).get('/v1/alerts?status=all');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /openapi returns the spec', async () => {
    const res = await request(app).get('/openapi');
    expect(res.status).toBe(200);
    expect(res.text).toContain('openapi: 3.1.0');
  });

  it('unknown route returns 404', async () => {
    const res = await request(app).get('/no-such-path');
    expect(res.status).toBe(404);
  });
});
