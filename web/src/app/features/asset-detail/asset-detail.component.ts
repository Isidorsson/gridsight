import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/api.service';
import { SseService } from '../../core/sse.service';
import { TelemetryChartComponent } from './telemetry-chart.component';
import { SeverityBadgeComponent } from '../../shared/severity-badge.component';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import type { Alert, Asset, Recommendation, TelemetryReading } from '../../core/types';

@Component({
  selector: 'gs-asset-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TelemetryChartComponent,
    SeverityBadgeComponent,
    EmptyStateComponent,
  ],
  template: `
    <a class="back" routerLink="/"><mat-icon>arrow_back</mat-icon> Fleet overview</a>

    @if (loading()) {
      <div class="loading"><mat-progress-spinner diameter="36" mode="indeterminate" /></div>
    } @else if (error()) {
      <gs-empty-state icon="error_outline" title="Asset not found" [description]="error()!" />
    } @else if (asset(); as a) {
      <header class="hero">
        <div>
          <h1>{{ a.name }}</h1>
          <p class="meta">
            <code>{{ a.id }}</code>
            · {{ typeLabel(a.assetType) }}
            · {{ a.locationName }}
          </p>
        </div>
        <dl class="specs">
          <div><dt>Voltage</dt><dd>{{ a.primaryVoltageKv }} / {{ a.secondaryVoltageKv }} kV</dd></div>
          <div><dt>Rated</dt><dd>{{ a.ratedPowerKva }} kVA</dd></div>
          <div><dt>Cooling</dt><dd>{{ a.coolingClass }}</dd></div>
          <div><dt>Oil</dt><dd>{{ a.oilType }}</dd></div>
          <div><dt>Installed</dt><dd>{{ a.installYear }}</dd></div>
          <div><dt>Last inspection</dt><dd>{{ a.lastInspectionDate ?? '—' }}</dd></div>
        </dl>
      </header>

      @if (openAlerts().length > 0) {
        <section class="alerts-banner">
          <h2><mat-icon>warning</mat-icon> {{ openAlerts().length }} open {{ openAlerts().length === 1 ? 'alert' : 'alerts' }}</h2>
          <ul>
            @for (al of openAlerts(); track al.id) {
              <li>
                <gs-severity-badge [severity]="al.severity" />
                <span class="rule"><code>{{ al.rule }}</code></span>
                <span class="msg">{{ al.message }}</span>
              </li>
            }
          </ul>
        </section>
      }

      <section class="charts">
        @if (readings().length > 0) {
          <gs-telemetry-chart [readings]="readings()" metric="oilTempC"
            [series]="{ label: 'Top-oil temperature', unit: '°C', color: '#dc2626', warn: 95, alarm: 105 }" />
          <gs-telemetry-chart [readings]="readings()" metric="windingTempC"
            [series]="{ label: 'Hottest-spot winding', unit: '°C', color: '#ea580c', warn: 110, alarm: 130 }" />
          <gs-telemetry-chart [readings]="readings()" metric="loadFactor"
            [series]="{ label: 'Load factor', unit: 'pu', color: '#1976d2', warn: 1.0, alarm: 1.2 }" />
          <gs-telemetry-chart [readings]="readings()" metric="voltagePu"
            [series]="{ label: 'Voltage', unit: 'pu', color: '#7c3aed' }" />
          <gs-telemetry-chart [readings]="readings()" metric="dgaH2Ppm"
            [series]="{ label: 'DGA H₂', unit: 'ppm', color: '#16a34a', warn: 100, alarm: 700 }" />
          <gs-telemetry-chart [readings]="readings()" metric="dgaC2h2Ppm"
            [series]="{ label: 'DGA C₂H₂ (acetylene)', unit: 'ppm', color: '#0891b2', alarm: 5 }" />
        } @else {
          <gs-empty-state icon="hourglass_empty" title="Awaiting telemetry"
            description="The simulator emits readings every 5 seconds. The first batch should arrive shortly." />
        }
      </section>

      <section class="recommendation">
        <header>
          <h2>AI maintenance recommendation</h2>
          <button mat-flat-button color="primary" type="button"
                  [disabled]="recLoading()" (click)="fetchRecommendation()">
            @if (recLoading()) { <mat-progress-spinner diameter="18" mode="indeterminate" /> }
            @else { <mat-icon>auto_awesome</mat-icon> }
            {{ recLoading() ? 'Analyzing…' : recommendation() ? 'Refresh' : 'Generate' }}
          </button>
        </header>

        @if (recError()) {
          <p class="rec-error">{{ recError() }}</p>
        }

        @if (recommendation(); as rec) {
          <div class="rec-card">
            <div class="rec-meta">
              <gs-severity-badge [severity]="rec.urgency" />
              <span class="confidence">confidence: <strong>{{ rec.confidence * 100 | number: '1.0-0' }}%</strong></span>
              <span class="source" [class.live]="rec.source === 'live'">
                {{ rec.source === 'live' ? 'Claude live' : 'demo fixture' }}
              </span>
            </div>
            <h3>Root cause</h3>
            <p>{{ rec.root_cause }}</p>
            <h3>Recommended actions</h3>
            <ol class="actions">
              @for (act of rec.recommended_actions; track $index) {
                <li>
                  <span class="priority" [class]="act.priority">{{ act.priority }}</span>
                  <strong>{{ act.action }}</strong>
                  <p class="rationale">{{ act.rationale }}</p>
                </li>
              }
            </ol>
            @if (rec.references && rec.references.length > 0) {
              <p class="refs"><strong>References:</strong> {{ rec.references.join(' · ') }}</p>
            }
          </div>
        } @else if (!recLoading()) {
          <p class="rec-hint">Generate a recommendation to see structured maintenance guidance derived from current telemetry and any open alerts.</p>
        }
      </section>
    }
  `,
  styles: [
    `
      .back {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        margin-bottom: 1rem;
        font-size: 0.88rem;
        color: var(--gs-text-muted);
      }
      .back mat-icon { font-size: 1.05rem; width: 1.05rem; height: 1.05rem; }
      .hero {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1.5rem;
        padding: 1.25rem 1.5rem;
        background: var(--gs-surface);
        border: 1px solid var(--gs-border);
        border-radius: 12px;
        margin-bottom: 1rem;
      }
      h1 {
        margin: 0 0 0.4rem;
        font-size: 1.4rem;
        font-weight: 600;
      }
      .meta {
        margin: 0;
        color: var(--gs-text-muted);
        font-size: 0.88rem;
      }
      .meta code { font-family: var(--gs-mono); }
      .specs {
        display: grid;
        grid-template-columns: repeat(3, auto);
        gap: 0.4rem 1.5rem;
        margin: 0;
      }
      .specs dt {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--gs-text-muted);
      }
      .specs dd {
        margin: 0;
        font-family: var(--gs-mono);
        font-size: 0.92rem;
      }
      .alerts-banner {
        background: rgba(220, 38, 38, 0.06);
        border: 1px solid rgba(220, 38, 38, 0.25);
        border-radius: 12px;
        padding: 1rem 1.25rem;
        margin-bottom: 1rem;
      }
      .alerts-banner h2 {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        margin: 0 0 0.6rem;
        font-size: 0.95rem;
        color: var(--gs-high);
      }
      .alerts-banner ul {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
      .alerts-banner li {
        display: grid;
        grid-template-columns: auto auto 1fr;
        gap: 0.6rem;
        align-items: baseline;
        font-size: 0.88rem;
      }
      .alerts-banner .rule code { font-family: var(--gs-mono); font-size: 0.78rem; color: var(--gs-text-muted); }
      .charts {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 0.75rem;
        margin-bottom: 1.25rem;
      }
      .recommendation {
        background: var(--gs-surface);
        border: 1px solid var(--gs-border);
        border-radius: 12px;
        padding: 1.1rem 1.5rem;
      }
      .recommendation header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.85rem;
      }
      .recommendation h2 {
        margin: 0;
        font-size: 1rem;
      }
      .rec-card { padding: 0.5rem 0; }
      .rec-meta {
        display: flex;
        gap: 0.85rem;
        align-items: center;
        margin-bottom: 0.85rem;
        font-size: 0.85rem;
        color: var(--gs-text-muted);
      }
      .rec-meta .source {
        font-family: var(--gs-mono);
        font-size: 0.75rem;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        background: var(--gs-surface-2);
      }
      .rec-meta .source.live {
        background: rgba(22, 163, 74, 0.12);
        color: var(--gs-low);
      }
      .rec-card h3 {
        margin: 0.85rem 0 0.4rem;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--gs-text-muted);
      }
      .rec-card p { margin: 0 0 0.5rem; font-size: 0.92rem; line-height: 1.5; }
      .actions {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .actions li {
        padding: 0.65rem 0.85rem;
        background: var(--gs-surface-2);
        border-radius: 8px;
      }
      .priority {
        display: inline-block;
        font-family: var(--gs-mono);
        font-size: 0.7rem;
        text-transform: uppercase;
        padding: 0.1rem 0.45rem;
        border-radius: 4px;
        margin-right: 0.5rem;
        font-weight: 600;
      }
      .priority.now { background: var(--gs-critical); color: white; }
      .priority.soon { background: rgba(217, 119, 6, 0.2); color: var(--gs-medium); }
      .priority.planned { background: rgba(25, 118, 210, 0.15); color: var(--gs-accent); }
      .actions strong { font-size: 0.95rem; }
      .actions .rationale {
        margin: 0.2rem 0 0;
        font-size: 0.85rem;
        color: var(--gs-text-muted);
      }
      .refs {
        margin-top: 0.85rem;
        font-size: 0.8rem;
        color: var(--gs-text-muted);
        font-family: var(--gs-mono);
      }
      .rec-hint, .rec-error {
        margin: 0;
        font-size: 0.88rem;
        color: var(--gs-text-muted);
      }
      .rec-error { color: var(--gs-high); }
      .loading { display: flex; justify-content: center; padding: 3rem 1rem; }
      @media (max-width: 720px) {
        .hero { flex-direction: column; }
        .specs { grid-template-columns: repeat(2, auto); }
      }
    `,
  ],
})
export class AssetDetailComponent {
  private readonly api = inject(ApiService);
  private readonly sse = inject(SseService);

  readonly id = input.required<string>();

  protected readonly asset = signal<Asset | null>(null);
  protected readonly readings = signal<TelemetryReading[]>([]);
  protected readonly alerts = signal<Alert[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly recommendation = signal<Recommendation | null>(null);
  protected readonly recLoading = signal(false);
  protected readonly recError = signal<string | null>(null);

  protected readonly openAlerts = computed(() => this.alerts().filter((a) => a.status === 'open'));

  constructor() {
    queueMicrotask(() => this.load());
  }

  private load(): void {
    const id = this.id();

    this.api.getAsset(id).pipe(takeUntilDestroyed()).subscribe({
      next: (a) => {
        this.asset.set(a);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? err?.message ?? 'Unknown error');
        this.loading.set(false);
      },
    });

    this.api.getTelemetry(id, 120).pipe(takeUntilDestroyed()).subscribe({
      next: (res) => this.readings.set(res.items),
    });

    this.api.listAlerts('all').pipe(takeUntilDestroyed()).subscribe({
      next: (res) => this.alerts.set(res.items.filter((a) => a.assetId === id)),
    });

    this.sse.telemetry$.pipe(takeUntilDestroyed()).subscribe((r) => {
      if (r.assetId !== id) return;
      const next = [...this.readings(), r];
      if (next.length > 240) next.splice(0, next.length - 240);
      this.readings.set(next);
    });

    this.sse.alerts$.pipe(takeUntilDestroyed()).subscribe((al) => {
      if (al.assetId !== id) return;
      this.alerts.set([al, ...this.alerts()]);
    });
  }

  protected fetchRecommendation(): void {
    this.recLoading.set(true);
    this.recError.set(null);
    this.api.getRecommendation(this.id()).pipe(takeUntilDestroyed()).subscribe({
      next: (r) => {
        this.recommendation.set(r);
        this.recLoading.set(false);
      },
      error: (err) => {
        this.recError.set(err?.error?.message ?? err?.message ?? 'Failed to generate recommendation');
        this.recLoading.set(false);
      },
    });
  }

  protected typeLabel(t: Asset['assetType']): string {
    switch (t) {
      case 'distribution_transformer': return 'Distribution Transformer';
      case 'mv_lv_substation': return 'MV/LV Substation';
      case 'feeder_breaker': return 'Feeder Breaker';
    }
  }
}
