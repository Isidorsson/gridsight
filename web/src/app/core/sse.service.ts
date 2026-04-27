import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import type { Alert, TelemetryReading } from './types';

/**
 * Server-Sent Events client. Auto-reconnects with exponential backoff on close.
 * Exposes per-event-type subjects + a connected signal for status indicators.
 */
@Injectable({ providedIn: 'root' })
export class SseService {
  private readonly destroyRef = inject(DestroyRef);
  private es: EventSource | null = null;
  private retryDelayMs = 1000;
  private readonly maxRetryDelayMs = 30_000;

  readonly connected = signal(false);

  readonly telemetry$ = new Subject<TelemetryReading>();
  readonly alerts$ = new Subject<Alert>();

  constructor() {
    this.connect();
    this.destroyRef.onDestroy(() => this.disconnect());
  }

  private connect(): void {
    if (this.es) return;
    const url = `${environment.apiBaseUrl}/v1/stream`;
    this.es = new EventSource(url);

    this.es.addEventListener('open', () => {
      this.connected.set(true);
      this.retryDelayMs = 1000;
    });

    this.es.addEventListener('telemetry', (ev: MessageEvent) => {
      try {
        this.telemetry$.next(JSON.parse(ev.data) as TelemetryReading);
      } catch (err) {
        console.warn('Failed to parse telemetry event', err);
      }
    });

    this.es.addEventListener('alert', (ev: MessageEvent) => {
      try {
        this.alerts$.next(JSON.parse(ev.data) as Alert);
      } catch (err) {
        console.warn('Failed to parse alert event', err);
      }
    });

    this.es.addEventListener('error', () => {
      this.connected.set(false);
      this.es?.close();
      this.es = null;
      const delay = this.retryDelayMs;
      this.retryDelayMs = Math.min(this.retryDelayMs * 2, this.maxRetryDelayMs);
      setTimeout(() => this.connect(), delay);
    });
  }

  private disconnect(): void {
    this.es?.close();
    this.es = null;
    this.connected.set(false);
  }
}
