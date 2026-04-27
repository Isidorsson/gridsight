import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LucideAngularModule, Loader2, Check, ArrowUpRight } from 'lucide-angular';
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
    LucideAngularModule,
    SeverityBadgeComponent,
    EmptyStateComponent,
  ],
  template: `
    <section class="page-head">
      <span class="eyebrow">Alerts · 02 Threshold rules</span>
      <h1>Anomaly stream</h1>
      <p class="lede">
        Threshold-based rules referenced against IEEE&nbsp;C57.91 and IEC&nbsp;C57.104.
        Acknowledge to silence; resolved alerts are kept for audit trail.
      </p>
    </section>

    <div class="filter-bar" role="tablist" aria-label="Filter alerts by status">
      @for (f of filters; track f.value) {
        <button type="button"
                role="tab"
                [attr.aria-selected]="status() === f.value"
                [class.active]="status() === f.value"
                (click)="status.set(f.value)">
          <span class="dot" [attr.data-state]="f.value"></span>
          {{ f.label }}
          <span class="count">{{ countFor(f.value) | number: '2.0-0' }}</span>
        </button>
      }
    </div>

    @if (loading()) {
      <div class="loading">
        <i-lucide [img]="LoaderIcon" class="gs-spin" [size]="22" [strokeWidth]="1.6"></i-lucide>
        <p class="mono">SYNCHRONISING ALERT LOG…</p>
      </div>
    } @else if (visible().length === 0) {
      <gs-empty-state icon="check_circle"
                      [title]="status() === 'open' ? 'No active alerts' : 'No matching alerts'"
                      [description]="'Switch filters to view past alerts.'" />
    } @else {
      <ul class="alerts">
        @for (al of visible(); track al.id) {
          <li class="alert-row" [attr.data-severity]="al.severity" [class.is-closed]="al.status !== 'open'">
            <gs-severity-badge [severity]="al.severity" />
            <div class="content">
              <div class="line-1">
                <a [routerLink]="['/assets', al.assetId]" class="asset">
                  {{ al.assetId }}
                  <i-lucide [img]="ArrowIcon" [size]="11" [strokeWidth]="2.2" aria-hidden="true"></i-lucide>
                </a>
                <code class="rule">{{ al.rule }}</code>
                <span class="ts">{{ al.raisedAt | date: 'medium' }}</span>
              </div>
              <p class="msg">{{ al.message }}</p>
              @if (al.status === 'ack' && al.ackedAt) {
                <p class="meta">
                  <i-lucide [img]="CheckIcon" [size]="12" [strokeWidth]="2" aria-hidden="true"></i-lucide>
                  acknowledged {{ al.ackedAt | date: 'short' }}{{ al.ackUser ? ' by ' + al.ackUser : '' }}
                </p>
              }
            </div>
            @if (al.status === 'open') {
              <button type="button" class="ack-btn" (click)="ack(al)" [disabled]="acking() === al.id">
                @if (acking() === al.id) {
                  <i-lucide [img]="LoaderIcon" class="gs-spin" [size]="13" [strokeWidth]="2"></i-lucide>
                  ACK…
                } @else {
                  ACKNOWLEDGE
                }
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
      .page-head {
        margin-bottom: 1.75rem;
        max-width: 70ch;
      }
      .page-head h1 {
        margin: 0.6rem 0 0.55rem;
        font-size: clamp(1.45rem, 2.2vw, 2rem);
        font-weight: 500;
        letter-spacing: -0.018em;
        color: var(--gs-text-strong);
      }
      .page-head .lede {
        margin: 0;
        color: var(--gs-text-muted);
        font-size: 0.92rem;
        max-width: 60ch;
      }

      .filter-bar {
        display: inline-flex;
        background: var(--gs-surface);
        border: 1px solid var(--gs-border);
        border-radius: var(--gs-radius);
        padding: 0.25rem;
        gap: 0.15rem;
        margin-bottom: 1.5rem;
      }
      .filter-bar button {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.45rem 0.85rem;
        border: 0;
        background: transparent;
        color: var(--gs-text-muted);
        font-family: var(--gs-mono);
        font-size: 0.74rem;
        font-weight: 500;
        letter-spacing: 0.06em;
        border-radius: var(--gs-radius-3);
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
      }
      .filter-bar button:hover { color: var(--gs-text); }
      .filter-bar button.active {
        background: var(--gs-accent-soft);
        color: var(--gs-accent-bright);
        box-shadow: inset 0 0 0 1px var(--gs-accent-line);
      }
      .filter-bar .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--gs-text-faint);
      }
      .filter-bar .dot[data-state='open']     { background: var(--gs-medium); }
      .filter-bar .dot[data-state='ack']      { background: var(--gs-cool); }
      .filter-bar .dot[data-state='resolved'] { background: var(--gs-low); }
      .filter-bar .dot[data-state='all']      { background: var(--gs-text-muted); }
      .filter-bar .count {
        font-size: 0.66rem;
        color: var(--gs-text-faint);
        margin-left: 0.25rem;
        font-variant-numeric: tabular-nums;
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
        gap: 1rem;
        align-items: start;
        padding: 0.95rem 1.1rem;
        background: var(--gs-surface);
        border: 1px solid var(--gs-border);
        border-left-width: 3px;
        border-radius: var(--gs-radius);
        transition: border-color 0.15s;
      }
      .alert-row[data-severity='critical'] { border-left-color: var(--gs-critical); }
      .alert-row[data-severity='high']     { border-left-color: var(--gs-high); }
      .alert-row[data-severity='medium']   { border-left-color: var(--gs-medium); }
      .alert-row[data-severity='low']      { border-left-color: var(--gs-low); }
      .alert-row.is-closed { opacity: 0.7; }

      .line-1 {
        display: flex;
        gap: 0.6rem;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 0.3rem;
      }
      .asset {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        font-family: var(--gs-mono);
        font-size: 0.86rem;
        font-weight: 600;
        color: var(--gs-text);
        padding: 0.18rem 0.4rem;
        background: var(--gs-bg-2);
        border: 1px solid var(--gs-border);
        border-radius: var(--gs-radius-3);
        text-decoration: none;
      }
      .asset:hover {
        color: var(--gs-accent);
        border-color: var(--gs-accent-line);
        text-decoration: none;
      }
      .rule {
        font-family: var(--gs-mono);
        font-size: 0.74rem;
        color: var(--gs-text-muted);
      }
      .ts {
        font-family: var(--gs-mono);
        font-size: 0.72rem;
        color: var(--gs-text-faint);
        margin-left: auto;
        font-variant-numeric: tabular-nums;
      }
      .msg { margin: 0; font-size: 0.9rem; line-height: 1.5; color: var(--gs-text); }
      .meta {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        margin: 0.4rem 0 0;
        font-family: var(--gs-mono);
        font-size: 0.7rem;
        color: var(--gs-text-faint);
        letter-spacing: 0.04em;
      }
      .meta i-lucide { color: var(--gs-low); }

      .ack-btn {
        font-family: var(--gs-mono);
        font-size: 0.68rem;
        font-weight: 600;
        letter-spacing: 0.14em;
        padding: 0.5rem 0.85rem;
        background: transparent;
        color: var(--gs-text);
        border: 1px solid var(--gs-border-2);
        border-radius: var(--gs-radius-3);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        transition: border-color 0.15s, background 0.15s, color 0.15s;
      }
      .ack-btn:hover:not(:disabled) {
        border-color: var(--gs-accent);
        color: var(--gs-accent);
        background: var(--gs-accent-soft);
      }
      .ack-btn:disabled { opacity: 0.6; cursor: progress; }

      .status-pill {
        font-family: var(--gs-mono);
        font-size: 0.66rem;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        padding: 0.35rem 0.7rem;
        border-radius: var(--gs-radius-3);
        background: var(--gs-bg-2);
        color: var(--gs-text-muted);
        border: 1px solid var(--gs-border);
        font-weight: 600;
      }
      .status-pill.ack {
        background: var(--gs-cool-soft);
        color: var(--gs-cool);
        border-color: rgba(124, 223, 255, 0.3);
      }
      .status-pill.resolved {
        background: var(--gs-low-soft);
        color: var(--gs-low);
        border-color: rgba(74, 222, 128, 0.3);
      }

      .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.85rem;
        padding: 4rem 1rem;
        color: var(--gs-text-muted);
      }
      .loading p {
        margin: 0;
        font-size: 0.7rem;
        letter-spacing: 0.16em;
        color: var(--gs-text-faint);
      }
    `,
  ],
})
export class AlertsComponent {
  private readonly api = inject(ApiService);
  private readonly sse = inject(SseService);
  private readonly snack = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly LoaderIcon = Loader2;
  protected readonly CheckIcon = Check;
  protected readonly ArrowIcon = ArrowUpRight;

  protected readonly filters: ReadonlyArray<{ value: StatusFilter; label: string }> = [
    { value: 'open', label: 'OPEN' },
    { value: 'ack', label: 'ACK' },
    { value: 'resolved', label: 'RESOLVED' },
    { value: 'all', label: 'ALL' },
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

  protected countFor(s: StatusFilter): number {
    if (s === 'all') return this.all().length;
    return this.all().filter((a) => a.status === s).length;
  }

  constructor() {
    this.api.listAlerts('all').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.all.set(res.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.sse.alerts$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((al) => {
      this.all.set([al, ...this.all()]);
    });
  }

  protected ack(alert: Alert): void {
    this.acking.set(alert.id);
    this.api.ackAlert(alert.id, 'demo-user').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
