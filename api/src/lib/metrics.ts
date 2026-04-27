import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

export const registry = new Registry();
registry.setDefaultLabels({ service: 'gridsight-api' });
collectDefaultMetrics({ register: registry });

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests by method, route, and status',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const alertsRaisedTotal = new Counter({
  name: 'gridsight_alerts_raised_total',
  help: 'Alerts raised by severity and rule',
  labelNames: ['severity', 'rule'] as const,
  registers: [registry],
});

export const recommendationsTotal = new Counter({
  name: 'gridsight_recommendations_total',
  help: 'Recommendation requests by source (live | fixture)',
  labelNames: ['source'] as const,
  registers: [registry],
});

export const sseClientsGauge = new Counter({
  name: 'gridsight_sse_clients_total',
  help: 'Total SSE clients ever connected (use rate/derivative for active count)',
  registers: [registry],
});
