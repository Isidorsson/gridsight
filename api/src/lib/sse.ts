import type { Response } from 'express';
import { sseClientsGauge } from './metrics.js';

export type SseEvent = {
  event: string;
  data: unknown;
  id?: string;
};

class SseBus {
  private clients = new Set<Response>();

  subscribe(res: Response): () => void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(`: connected ${new Date().toISOString()}\n\n`);

    this.clients.add(res);
    sseClientsGauge.inc();

    const heartbeat = setInterval(() => {
      try {
        res.write(`: hb\n\n`);
      } catch {
        clearInterval(heartbeat);
      }
    }, 15000);

    const cleanup = (): void => {
      clearInterval(heartbeat);
      this.clients.delete(res);
      try {
        res.end();
      } catch {
        // already closed
      }
    };

    res.on('close', cleanup);
    return cleanup;
  }

  publish(event: SseEvent): void {
    const lines: string[] = [];
    if (event.id) lines.push(`id: ${event.id}`);
    lines.push(`event: ${event.event}`);
    lines.push(`data: ${JSON.stringify(event.data)}`);
    const payload = lines.join('\n') + '\n\n';

    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  size(): number {
    return this.clients.size;
  }

  closeAll(): void {
    for (const client of this.clients) {
      try {
        client.end();
      } catch {
        // ignore
      }
    }
    this.clients.clear();
  }
}

export const sseBus = new SseBus();
