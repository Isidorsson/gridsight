# GridSight

Substation asset health monitor — Angular 17 dashboard + Node/Express + TypeScript API.

A vertical slice that demonstrates real-time telemetry monitoring for distribution-grid assets: simulated SCADA-style sensor readings, threshold-based anomaly alerts, and Anthropic-powered maintenance recommendations.

## Architecture

```
Angular 17 SPA  ──HTTPS/SSE──►  Express + TS API  ──►  SQLite
                                       │
                                       ├──►  SCADA simulator (in-process)
                                       └──►  Anthropic Claude (env-gated)
```

- **Public demo serves recommendation fixtures** — no API key in deployed env. The real Anthropic integration is in `api/src/domain/recommender.ts` and runs locally when `ANTHROPIC_API_KEY` is set.
- **Stateless API, env-driven config** — Azure App Service portable.

## Repo layout

```
gridsight/
├── api/   # Node + Express + TypeScript backend
└── web/   # Angular 17 frontend (added Day 5 of build plan)
```

## Quick start (API only — Day 1 scope)

```bash
cd api
npm install
npm run dev
# API on http://localhost:3000
# OpenAPI on http://localhost:3000/openapi
# Metrics on http://localhost:3000/metrics
```

## Build status

This project is being built incrementally over 14 days. See the parent portfolio plan for the day-by-day sequence.

Three places need domain judgment from the project author (search for `USER CONTRIBUTION` in the codebase):

1. `api/src/domain/assets.ts` — asset taxonomy fields
2. `api/src/domain/simulator.ts` — anomaly detection thresholds
3. `api/src/domain/recommender.ts` + `api/src/domain/fixtures/recommendations/` — LLM prompt and fixture authoring

## Standards referenced

- IEEE C57.91 (loading guide for transformers — hot-spot temperature)
- IEC 60076 (power transformer specifications)

These inform threshold choices in the simulator. The project does not claim compliance.
