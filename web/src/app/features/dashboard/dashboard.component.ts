import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/api.service';
import { SseService } from '../../core/sse.service';
import { AssetCardComponent } from '../../shared/asset-card.component';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import type { Alert, Asset, TelemetryReading } from '../../core/types';

type FilterMode = 'all' | 'with_alerts';

@Component({
  selector: 'gs-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule, AssetCardComponent, EmptyStateComponent],
  template: `
    <header class="page-header">
      <div>
        <h1>Fleet overview</h1>
        <p>Live telemetry from {{ assets().length || '—' }} distribution-grid assets across the Solna metro area.</p>
      </div>
      <div class="header-actions">
        <div class="counters">
          <button type="button" class="counter" [class.active]="filter() === 'all'" (click)="filter.set('all')">
            <strong>{{ assets().length }}</strong><span>total</span>
          </button>
          <button type="button" class="counter alert" [class.active]="filter() === 'with_alerts'" (click)="filter.set('with_alerts')">
            <strong>{{ assetsWithAlerts().length }}</strong><span>with alerts</span>
          </button>
        </div>
      </div>
    </header>

    @if (loading()) {
      <div class="loading">
        <mat-progress-spinner diameter="36" mode="indeterminate" />
        <p>Loading fleet…</p>
      </div>
    } @else if (error()) {
      <gs-empty-state icon="error_outline" [title]="'Could not load assets'" [description]="error()!" />
    } @else if (visibleAssets().length === 0) {
      <gs-empty-state icon="check_circle"
                      [title]="filter() === 'with_alerts' ? 'No active alerts' : 'No assets configured'"
                      [description]="filter() === 'with_alerts' ? 'All monitored assets are operating within normal parameters.' : 'Seed the database to populate the fleet.'" />
    } @else {
      <div class="grid">
        @for (a of visibleAssets(); track a.id) {
          <gs-asset-card [asset]="a"
                         [latest]="latestByAsset().get(a.id) ?? null"
                         [alerts]="alertsByAsset().get(a.id) ?? []" />
        }
      </div>
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
      h1 {
        margin: 0 0 0.35rem;
        font-size: 1.5rem;
        font-weight: 600;
      }
      .page-header p {
        margin: 0;
        color: var(--gs-text-muted);
        font-size: 0.92rem;
      }
      .counters {
        display: flex;
        gap: 0.5rem;
      }
      .counter {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0.5rem 0.85rem;
        background: var(--gs-surface);
        border: 1px solid var(--gs-border);
        border-radius: 10px;
        cursor: pointer;
        font-family: inherit;
        color: var(--gs-text);
        transition: border-color 0.15s, background 0.15s;
      }
      .counter strong {
        font-size: 1.25rem;
        font-weight: 600;
        line-height: 1;
        font-family: var(--gs-mono);
      }
      .counter span {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--gs-text-muted);
        margin-top: 0.18rem;
      }
      .counter:hover {
        border-color: var(--gs-accent);
      }
      .counter.active {
        border-color: var(--gs-accent);
        background: var(--gs-accent-soft);
      }
      .counter.alert.active strong { color: var(--gs-high); }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
        gap: 1rem;
      }
      .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 3rem 1rem;
        color: var(--gs-text-muted);
      }
      .loading p { margin: 0; font-size: 0.9rem; }
    `,
  ],
})
export class DashboardComponent {
  private readonly api = inject(ApiService);
  private readonly sse = inject(SseService);

  protected readonly assets = signal<Asset[]>([]);
  protected readonly latestByAsset = signal<Map<string, TelemetryReading>>(new Map());
  protected readonly alertsByAsset = signal<Map<string, Alert[]>>(new Map());
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly filter = signal<FilterMode>('all');

  protected readonly assetsWithAlerts = computed(() =>
    this.assets().filter((a) => (this.alertsByAsset().get(a.id)?.length ?? 0) > 0),
  );

  protected readonly visibleAssets = computed(() =>
    this.filter() === 'with_alerts' ? this.assetsWithAlerts() : this.assets(),
  );

  constructor() {
    this.api
      .listAssets()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (res) => {
          this.assets.set(res.items);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Unknown error');
          this.loading.set(false);
        },
      });

    this.api
      .listAlerts('open')
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (res) => {
          const map = new Map<string, Alert[]>();
          for (const a of res.items) {
            const list = map.get(a.assetId) ?? [];
            list.push(a);
            map.set(a.assetId, list);
          }
          this.alertsByAsset.set(map);
        },
      });

    this.sse.telemetry$.pipe(takeUntilDestroyed()).subscribe((reading) => {
      const next = new Map(this.latestByAsset());
      next.set(reading.assetId, reading);
      this.latestByAsset.set(next);
    });

    this.sse.alerts$.pipe(takeUntilDestroyed()).subscribe((alert) => {
      const next = new Map(this.alertsByAsset());
      const list = next.get(alert.assetId) ?? [];
      next.set(alert.assetId, [alert, ...list]);
      this.alertsByAsset.set(next);
    });
  }
}
