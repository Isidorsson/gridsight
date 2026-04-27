import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../core/api.service';
import { SseService } from '../../core/sse.service';
import { SeverityBadgeComponent } from '../../shared/severity-badge.component';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import type { Alert } from '../../core/types';

type StatusFilter = 'open' | 'ack' | 'resolved' | 'all';

@Component({
  selector: 'gs-alerts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    SeverityBadgeComponent,
    EmptyStateComponent,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1>Alerts</h1>
        <p>Anomalies raised by threshold rules. Acknowledge to silence; rules reference IEEE C57.91 / C57.104.</p>
      </div>
      <div class="filter-group" role="tablist" aria-label="Filter alerts by status">
        @for (f of filters; track f.value) {
          <button type="button"
                  role="tab"
                  [attr.aria-selected]="status() === f.value"
                  [class.active]="status() === f.value"
                  (click)="status.set(f.value)">
            {{ f.label }}
          </button>
        }
      </div>
    </header>

    @if (loading()) {
      <div class="loading"><mat-progress-spinner diameter="36" mode="indeterminate" /></div>
    } @else if (visible().length === 0) {
      <gs-empty-state icon="check_circle"
                      [title]="status() === 'open' ? 'No active alerts' : 'No matching alerts'"
                      [description]="'Switch filters to view past alerts.'" />
    } @else {
      <ul class="alerts">
        @for (al of visible(); track al.id) {
          <li class="alert-row">
            <gs-severity-badge [severity]="al.severity" />
            <div class="content">
              <div class="line-1">
                <a [routerLink]="['/assets', al.assetId]" class="asset">{{ al.assetId }}</a>
                <code class="rule">{{ al.rule }}</code>
                <span class="ts">{{ al.raisedAt | date: 'short' }}</span>
              </div>
              <p class="msg">{{ al.message }}</p>
              @if (al.status === 'ack' && al.ackedAt) {
                <p class="meta">acknowledged {{ al.ackedAt | date: 'short' }}{{ al.ackUser ? ' by ' + al.ackUser : '' }}</p>
              }
            </div>
            @if (al.status === 'open') {
              <button mat-stroked-button type="button" (click)="ack(al)" [disabled]="acking() === al.id">
                @if (acking() === al.id) { <mat-progress-spinner diameter="16" mode="indeterminate" /> }
                Acknowledge
              </button>
            } @else {
              <span class="status-pill" [class]="al.status">{{ al.status }}</span>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1.5rem;
        margin-bottom: 1.5rem;
      }
      h1 { margin: 0 0 0.35rem; font-size: 1.5rem; font-weight: 600; }
      .page-header p { margin: 0; color: var(--gs-text-muted); font-size: 0.92rem; max-width: 60ch; }
      .filter-group {
        display: inline-flex;
        background: var(--gs-surface);
        border: 1px solid var(--gs-border);
        border-radius: 10px;
        padding: 0.2rem;
        gap: 0.1rem;
      }
      .filter-group button {
        padding: 0.4rem 0.85rem;
        border: 0;
        background: transparent;
        color: var(--gs-text-muted);
        font-family: inherit;
        font-size: 0.85rem;
        font-weight: 500;
        border-radius: 8px;
        cursor: pointer;
      }
      .filter-group button:hover { color: var(--gs-text); }
      .filter-group button.active {
        background: var(--gs-accent-soft);
        color: var(--gs-accent);
      }
      .alerts {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .alert-row {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 0.85rem;
        align-items: start;
        padding: 0.85rem 1rem;
        background: var(--gs-surface);
        border: 1px solid var(--gs-border);
        border-radius: 10px;
      }
      .line-1 {
        display: flex;
        gap: 0.6rem;
        align-items: baseline;
        flex-wrap: wrap;
        margin-bottom: 0.2rem;
      }
      .asset {
        font-family: var(--gs-mono);
        font-size: 0.88rem;
        font-weight: 600;
      }
      .rule {
        font-family: var(--gs-mono);
        font-size: 0.78rem;
        color: var(--gs-text-muted);
      }
      .ts {
        font-size: 0.78rem;
        color: var(--gs-text-muted);
        margin-left: auto;
      }
      .msg { margin: 0; font-size: 0.9rem; line-height: 1.4; }
      .meta { margin: 0.35rem 0 0; font-size: 0.78rem; color: var(--gs-text-muted); }
      .status-pill {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 0.2rem 0.55rem;
        border-radius: 999px;
        background: var(--gs-surface-2);
        color: var(--gs-text-muted);
      }
      .status-pill.ack { background: rgba(25, 118, 210, 0.12); color: var(--gs-accent); }
      .status-pill.resolved { background: rgba(22, 163, 74, 0.12); color: var(--gs-low); }
      .loading { display: flex; justify-content: center; padding: 3rem 1rem; }
    `,
  ],
})
export class AlertsComponent {
  private readonly api = inject(ApiService);
  private readonly sse = inject(SseService);
  private readonly snack = inject(MatSnackBar);

  protected readonly filters: ReadonlyArray<{ value: StatusFilter; label: string }> = [
    { value: 'open', label: 'Open' },
    { value: 'ack', label: 'Acknowledged' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'all', label: 'All' },
  ];

  protected readonly all = signal<Alert[]>([]);
  protected readonly status = signal<StatusFilter>('open');
  protected readonly loading = signal(true);
  protected readonly acking = signal<string | null>(null);

  protected readonly visible = computed(() => {
    const s = this.status();
    if (s === 'all') return this.all();
    return this.all().filter((a) => a.status === s);
  });

  constructor() {
    this.api.listAlerts('all').pipe(takeUntilDestroyed()).subscribe({
      next: (res) => {
        this.all.set(res.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.sse.alerts$.pipe(takeUntilDestroyed()).subscribe((al) => {
      this.all.set([al, ...this.all()]);
    });
  }

  protected ack(alert: Alert): void {
    this.acking.set(alert.id);
    this.api.ackAlert(alert.id, 'demo-user').pipe(takeUntilDestroyed()).subscribe({
      next: (updated) => {
        this.all.set(this.all().map((a) => (a.id === updated.id ? updated : a)));
        this.snack.open(`Alert acknowledged`, 'Dismiss', { duration: 2500 });
        this.acking.set(null);
      },
      error: (err) => {
        this.snack.open(`Failed to acknowledge: ${err?.error?.message ?? err.message}`, 'Dismiss', { duration: 4000 });
        this.acking.set(null);
      },
    });
  }
}
