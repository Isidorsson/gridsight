# GridSight

Distribution-grid asset health + European grid mix — Angular 18 dashboard + Node/Express + TypeScript API.

Two vertical slices behind one design language:

1. **Asset performance & anomaly monitor** — simulated SCADA telemetry for a fleet of substation transformers, threshold-based alerts referenced to IEEE C57.91, Anthropic Claude maintenance recommendations.
2. **European grid · live mix & market** — generation mix per fuel type and 24h day-ahead prices across 10 ENTSO-E bidding zones, with cross-zone fossil-free comparison.

## Architecture

```
Angular 18 SPA  ──HTTPS/SSE──►  Express + TS API  ──►  SQLite
                                       │
                                       ├──►  SCADA simulator  (in-process)
                                       ├──►  OpenRouter (Claude + GPT, env-gated)
                                       └──►  Energy-Charts API (Fraunhofer ISE, mock fallback)
```

- **Public demo serves recommendation fixtures** — no API key in deployed env. The real LLM integration is in `api/src/domain/recommender.ts` and runs locally when `OPENROUTER_API_KEY` is set; users pick between Claude Sonnet/Opus and GPT-5/mini from a dropdown in the UI.
- **European grid mix is live by default** — pulls from Energy-Charts (no auth, no key). The frontend ships a 3-way `auto / live / mock` source toggle so you can compare the real upstream against a deterministic synthetic backend on the same UI; live errors fall back to mock automatically. 5-min in-process cache keeps the upstream call rate polite.
- **Stateless API, env-driven config** — Azure App Service portable.

## Repo layout

```
gridsight/
├── api/   # Node + Express + TypeScript backend
└── web/   # Angular 17 frontend (added Day 5 of build plan)
```

## Quick start (full stack)

```bash
# from repo root — first time only:
npm run install:all

# starts api + web together; Ctrl+C kills both:
npm run dev
```

Then open:

- Web: http://localhost:4200
- API: http://localhost:3000
- OpenAPI: http://localhost:3000/openapi
- Metrics: http://localhost:3000/metrics
- Live grid mix sample: http://localhost:3000/v1/grid/mix?zone=10Y1001A1001A47J

Other root scripts:

- `npm run typecheck` — both projects
- `npm run build` — both projects
- `npm start` — runs the **built** API + web dev server (production-ish)

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
