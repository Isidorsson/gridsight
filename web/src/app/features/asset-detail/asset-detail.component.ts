import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  LucideAngularModule,
  ArrowLeft,
  AlertTriangle,
  Sparkles,
  Loader2,
  CircleDot,
  Circle,
} from 'lucide-angular';
import { ApiService } from '../../core/api.service';
import { SseService } from '../../core/sse.service';
import { LanguageService } from '../../core/i18n/language.service';
import { TelemetryChartComponent } from './telemetry-chart.component';
import { SeverityBadgeComponent } from '../../shared/severity-badge.component';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import type { Alert, Asset, ModelOption, Recommendation, TelemetryReading } from '../../core/types';

const MODEL_STORAGE_KEY = 'gs.rec.model';

@Component({
  selector: 'gs-asset-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    LucideAngularModule,
    TelemetryChartComponent,
    SeverityBadgeComponent,
    EmptyStateComponent,
  ],
  template: `
    <a class="back" routerLink="/fleet">
      <i-lucide [img]="BackIcon" [size]="14" [strokeWidth]="2" aria-hidden="true"></i-lucide>
      {{ i18n.t('asset.back') }}
    </a>

    @if (loading()) {
      <div class="loading">
        <i-lucide [img]="LoaderIcon" class="gs-spin" [size]="22" [strokeWidth]="1.6"></i-lucide>
        <p class="mono">{{ i18n.t('asset.loading') }}</p>
      </div>
    } @else if (error()) {
      <gs-empty-state icon="error_outline" [title]="i18n.t('asset.notFound')" [description]="error()!" />
    }

    @if (asset(); as a) {
      <header class="hero">
        <div class="hero-left">
          <span class="eyebrow">{{ i18n.t('asset.eyebrow.prefix') }} {{ typeLabel(a.assetType) }}</span>
          <h1>{{ a.name }}</h1>
          <p class="meta">
            <code>{{ a.id }}</code>
            <span class="dot-sep">·</span>
            <span>{{ a.locationName }}</span>
          </p>
        </div>
        <dl class="specs">
          <div><dt>{{ i18n.t('asset.spec.voltage') }}</dt><dd>{{ a.primaryVoltageKv }} / {{ a.secondaryVoltageKv }} kV</dd></div>
          <div><dt>{{ i18n.t('asset.spec.rated') }}</dt><dd>{{ a.ratedPowerKva }} kVA</dd></div>
          <div><dt>{{ i18n.t('asset.spec.cooling') }}</dt><dd>{{ a.coolingClass }}</dd></div>
          <div><dt>{{ i18n.t('asset.spec.oil') }}</dt><dd>{{ a.oilType }}</dd></div>
          <div><dt>{{ i18n.t('asset.spec.installed') }}</dt><dd>{{ a.installYear }}</dd></div>
          <div><dt>{{ i18n.t('asset.spec.lastInsp') }}</dt><dd>{{ a.lastInspectionDate ?? '—' }}</dd></div>
        </dl>
      </header>

      @if (openAlerts().length > 0) {
        <section class="alerts-banner" [attr.data-severity]="bannerSeverity()">
          <header>
            <i-lucide class="alarm-icon" [img]="AlertIcon" [size]="16" [strokeWidth]="2" aria-hidden="true"></i-lucide>
            <h2>
              {{ openAlerts().length }} {{ openAlerts().length === 1 ? i18n.t('asset.alerts.open.singular') : i18n.t('asset.alerts.open.plural') }}
            </h2>
            <span class="raised-at mono">{{ i18n.t('asset.alerts.condition') }}</span>
          </header>
          <ul>
            @for (al of openAlerts(); track al.id) {
              <li>
                <gs-severity-badge [severity]="al.severity" />
                <code class="rule">{{ al.rule }}</code>
                <span class="msg">{{ al.message }}</span>
              </li>
            }
          </ul>
        </section>
      }

      <section class="charts-section">
        <header class="section-head">
          <span class="eyebrow">{{ i18n.t('asset.charts.eyebrow') }}</span>
          <h2>{{ i18n.t('asset.charts.title') }}</h2>
          <span class="hint mono">{{ readings().length }} {{ i18n.t('asset.charts.hint') }}</span>
        </header>
        @if (readings().length > 0) {
          <div class="charts">
            <gs-telemetry-chart [readings]="readings()" metric="oilTempC"
              [series]="{ label: i18n.t('asset.chart.oil'), unit: '°C', color: '#f59e0b', warn: 95, alarm: 105 }" />
            <gs-telemetry-chart [readings]="readings()" metric="windingTempC"
              [series]="{ label: i18n.t('asset.chart.winding'), unit: '°C', color: '#ef4444', warn: 110, alarm: 130 }" />
            <gs-telemetry-chart [readings]="readings()" metric="loadFactor"
              [series]="{ label: i18n.t('asset.chart.load'), unit: 'pu', color: '#7cdfff', warn: 1.0, alarm: 1.2 }" />
            <gs-telemetry-chart [readings]="readings()" metric="voltagePu"
              [series]="{ label: i18n.t('asset.chart.voltage'), unit: 'pu', color: '#a78bfa' }" />
            <gs-telemetry-chart [readings]="readings()" metric="dgaH2Ppm"
              [series]="{ label: i18n.t('asset.chart.h2'), unit: 'ppm', color: '#4ade80', warn: 100, alarm: 700 }" />
            <gs-telemetry-chart [readings]="readings()" metric="dgaC2h2Ppm"
              [series]="{ label: i18n.t('asset.chart.c2h2'), unit: 'ppm', color: '#e8a45c', alarm: 5 }" />
          </div>
        } @else {
          <gs-empty-state icon="hourglass_empty" [title]="i18n.t('asset.charts.empty.title')"
            [description]="i18n.t('asset.charts.empty.desc')" />
        }
      </section>

      <section class="recommendation">
        <header class="section-head">
          <span class="eyebrow">{{ i18n.t('asset.rec.eyebrow') }}</span>
          <h2>{{ i18n.t('asset.rec.title') }}</h2>
          @if (models().length > 0) {
            <label class="model-pick">
              <span class="lbl mono">{{ i18n.t('asset.rec.modelLabel') }}</span>
              <select [value]="selectedModel()" (change)="onModelChange($event)" [disabled]="recLoading()">
                @for (m of models(); track m.id) {
                  <option [value]="m.id">{{ m.label }} · {{ m.hint }}</option>
                }
              </select>
            </label>
          }
          <button type="button" class="rec-btn"
                  [disabled]="recLoading()" (click)="fetchRecommendation()">
            @if (recLoading()) {
              <i-lucide [img]="LoaderIcon" class="gs-spin" [size]="13" [strokeWidth]="2"></i-lucide>
              {{ i18n.t('asset.rec.btn.analyzing') }}
            } @else {
              <i-lucide [img]="SparkIcon" [size]="13" [strokeWidth]="1.8" aria-hidden="true"></i-lucide>
              {{ recommendation() ? i18n.t('asset.rec.btn.regenerate') : i18n.t('asset.rec.btn.generate') }}
            }
          </button>
        </header>

        @if (recError()) {
          <p class="rec-error">{{ recError() }}</p>
        }

        @if (recommendation(); as rec) {
          <div class="rec-card">
            <div class="rec-meta">
              <gs-severity-badge [severity]="rec.urgency" />
              <span class="confidence">
                <span class="lab">{{ i18n.t('asset.rec.confidence') }}</span>
                <strong>{{ rec.confidence * 100 | number: '1.0-0' }}%</strong>
              </span>
              <span class="source mono" [class.live]="rec.source === 'live'">
                <i-lucide [img]="rec.source === 'live' ? LiveIcon : InertIcon" [size]="11" [strokeWidth]="2" aria-hidden="true"></i-lucide>
                {{ rec.source === 'live' ? (rec.model ?? i18n.t('asset.rec.live')) : i18n.t('asset.rec.fixture') }}
              </span>
            </div>

            <div class="rec-grid">
              <div class="rec-col">
                <span class="eyebrow">{{ i18n.t('asset.rec.rootCause') }}</span>
                <p>{{ rec.root_cause }}</p>
              </div>
              <div class="rec-col">
                <span class="eyebrow">{{ i18n.t('asset.rec.actions') }}</span>
                <ol class="actions">
                  @for (act of rec.recommended_actions; track $index) {
                    <li>
                      <span class="priority" [class]="act.priority">{{ act.priority }}</span>
                      <strong>{{ act.action }}</strong>
                      <p class="rationale">{{ act.rationale }}</p>
                    </li>
                  }
                </ol>
              </div>
            </div>

            @if (rec.references && rec.references.length > 0) {
              <p class="refs">
                <span class="eyebrow">{{ i18n.t('asset.rec.references') }}</span>
                <span>{{ rec.references.join(' · ') }}</span>
              </p>
            }
          </div>
        } @else if (!recLoading()) {
          <p class="rec-hint">{{ i18n.t('asset.rec.hint') }}</p>
        }
      </section>
    }
  `,
  styles: [
    `
      .back {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
        font-family: var(--gs-mono);
        font-size: 0.72rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--gs-text-muted);
      }
      .back:hover { color: var(--gs-accent); text-decoration: none; }
      .back i-lucide { transition: transform 0.15s; }
      .back:hover i-lucide { transform: translateX(-2px); }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
        gap: 2.5rem;
        padding: 1.6rem 1.8rem;
        background:
          linear-gradient(180deg, rgba(232,164,92,0.04), transparent 60%),
          var(--gs-surface);
        border: 1px solid var(--gs-border);
        border-radius: var(--gs-radius-2);
        margin-bottom: 1.25rem;
        position: relative;
        overflow: hidden;
      }
      .hero::before {
        content: '';
        position: absolute;
        top: 0; bottom: 0; left: 0;
        width: 3px;
        background: linear-gradient(180deg, var(--gs-accent), transparent);
      }
      .hero h1 {
        margin: 0.45rem 0 0.5rem;
        font-size: clamp(1.45rem, 2.2vw, 1.95rem);
        font-weight: 500;
        letter-spacing: -0.02em;
        color: var(--gs-text-strong);
      }
      .hero .meta {
        margin: 0;
        color: var(--gs-text-muted);
        font-size: 0.88rem;
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        flex-wrap: wrap;
      }
      .hero .meta code {
        font-family: var(--gs-mono);
        font-size: 0.82rem;
        padding: 0.18rem 0.45rem;
        background: var(--gs-bg-2);
        border: 1px solid var(--gs-border);
        border-radius: var(--gs-radius-3);
        color: var(--gs-text);
      }
      .hero .dot-sep { color: var(--gs-accent); opacity: 0.7; }
      .specs {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.85rem 1.5rem;
        margin: 0;
        align-self: center;
      }
      .specs dt {
        font-family: var(--gs-mono);
        font-size: 0.62rem;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: var(--gs-text-faint);
        margin-bottom: 0.15rem;
      }
      .specs dd {
        margin: 0;
        font-family: var(--gs-mono);
        font-size: 0.92rem;
        color: var(--gs-text);
        font-variant-numeric: tabular-nums;
      }

      .alerts-banner {
        --bs: var(--gs-medium);
        background: var(--gs-medium-soft);
        border: 1px solid var(--bs);
        border-left-width: 3px;
        border-radius: var(--gs-radius-2);
        padding: 1rem 1.25rem 1.1rem;
        margin-bottom: 1.5rem;
      }
      .alerts-banner[data-severity='high'],
      .alerts-banner[data-severity='critical'] { --bs: var(--gs-high); background: var(--gs-high-soft); }
      .alerts-banner[data-severity='low'] { --bs: var(--gs-low); background: var(--gs-low-soft); }

      .alerts-banner header {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        margin: 0 0 0.85rem;
      }
      .alerts-banner .alarm-icon {
        color: var(--bs);
        animation: gs-pulse 1.6s ease-in-out infinite;
      }
      .alerts-banner h2 {
        margin: 0;
        font-family: var(--gs-mono);
        font-size: 0.78rem;
        font-weight: 600;
        letter-spacing: 0.16em;
        color: var(--bs);
      }
      .alerts-banner .raised-at {
        margin-left: auto;
        font-size: 0.66rem;
        color: var(--gs-text-faint);
        letter-spacing: 0.14em;
      }
      .alerts-banner ul {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
      }
      .alerts-banner li {
        display: grid;
        grid-template-columns: auto auto 1fr;
        gap: 0.7rem;
        align-items: baseline;
        font-size: 0.88rem;
      }
      .alerts-banner .rule {
        font-family: var(--gs-mono);
        font-size: 0.72rem;
        color: var(--gs-text-muted);
        background: rgba(0,0,0,0.18);
        padding: 0.14rem 0.4rem;
        border-radius: var(--gs-radius-3);
      }

      .charts-section, .recommendation {
        background: var(--gs-surface);
        border: 1px solid var(--gs-border);
        border-radius: var(--gs-radius-2);
        padding: 1.4rem 1.6rem 1.6rem;
        margin-bottom: 1.5rem;
      }
      .section-head {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        margin-bottom: 1.1rem;
        padding-bottom: 0.85rem;
        border-bottom: 1px solid var(--gs-divider);
      }
      .section-head h2 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 500;
        letter-spacing: -0.01em;
        color: var(--gs-text);
      }
      .section-head .eyebrow { flex: none; }
      .section-head .hint {
        margin-left: auto;
        font-size: 0.7rem;
        color: var(--gs-text-faint);
        letter-spacing: 0.06em;
      }

      .charts {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 0.75rem;
      }

      .model-pick {
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        font-family: var(--gs-mono);
      }
      .model-pick .lbl {
        font-size: 0.62rem;
        letter-spacing: 0.16em;
        color: var(--gs-text-faint);
      }
      .model-pick select {
        appearance: none;
        background: var(--gs-bg-2);
        color: var(--gs-text);
        border: 1px solid var(--gs-border);
        border-radius: var(--gs-radius);
        font-family: var(--gs-mono);
        font-size: 0.72rem;
        letter-spacing: 0.04em;
        padding: 0.35rem 1.6rem 0.35rem 0.6rem;
        background-image: linear-gradient(45deg, transparent 50%, var(--gs-text-faint) 50%),
                          linear-gradient(135deg, var(--gs-text-faint) 50%, transparent 50%);
        background-position: calc(100% - 12px) 50%, calc(100% - 7px) 50%;
        background-size: 5px 5px, 5px 5px;
        background-repeat: no-repeat;
        cursor: pointer;
      }
      .model-pick select:hover:not(:disabled) { border-color: var(--gs-accent-line); }
      .model-pick select:disabled { opacity: 0.5; cursor: not-allowed; }
      .model-pick + .rec-btn { margin-left: 0; }

      .rec-btn {
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.95rem;
        font-family: var(--gs-mono);
        font-size: 0.72rem;
        letter-spacing: 0.12em;
        font-weight: 600;
        background: var(--gs-accent);
        color: #1a0e02;
        border: 0;
        border-radius: var(--gs-radius);
        cursor: pointer;
        transition: background 0.15s, transform 0.1s;
      }
      .rec-btn:hover:not(:disabled) { background: var(--gs-accent-bright); }
      .rec-btn:active:not(:disabled) { transform: translateY(1px); }
      .rec-btn:disabled { opacity: 0.55; cursor: progress; }
      .rec-btn .spark { font-size: 0.85rem; }

      .rec-meta {
        display: flex;
        gap: 1rem;
        align-items: center;
        margin-bottom: 1.25rem;
        flex-wrap: wrap;
      }
      .rec-meta .confidence {
        display: inline-flex;
        flex-direction: column;
        gap: 0.1rem;
        font-family: var(--gs-mono);
      }
      .rec-meta .confidence .lab {
        font-size: 0.62rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--gs-text-faint);
      }
      .rec-meta .confidence strong {
        font-size: 1rem;
        font-weight: 500;
        color: var(--gs-text);
        font-variant-numeric: tabular-nums;
      }
      .rec-meta .source {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.66rem;
        letter-spacing: 0.16em;
        padding: 0.32rem 0.6rem;
        border-radius: var(--gs-radius-3);
        background: var(--gs-surface-2);
        border: 1px solid var(--gs-border);
        color: var(--gs-text-muted);
      }
      .rec-meta .source.live {
        background: var(--gs-low-soft);
        color: var(--gs-low);
        border-color: rgba(74, 222, 128, 0.35);
      }

      .rec-grid {
        display: grid;
        grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
        gap: 2rem;
      }
      .rec-col .eyebrow { display: block; margin-bottom: 0.6rem; }
      .rec-col p { margin: 0; font-size: 0.95rem; line-height: 1.55; color: var(--gs-text); }

      .actions {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
      }
      .actions li {
        padding: 0.75rem 0.95rem;
        background: var(--gs-bg-2);
        border: 1px solid var(--gs-border);
        border-left-width: 3px;
        border-radius: var(--gs-radius);
      }
      .actions li:has(.priority.now)     { border-left-color: var(--gs-critical); }
      .actions li:has(.priority.soon)    { border-left-color: var(--gs-medium); }
      .actions li:has(.priority.planned) { border-left-color: var(--gs-cool); }
      .priority {
        display: inline-block;
        font-family: var(--gs-mono);
        font-size: 0.62rem;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        padding: 0.22rem 0.55rem;
        border-radius: var(--gs-radius-3);
        margin-right: 0.65rem;
        font-weight: 600;
      }
      .priority.now     { background: var(--gs-critical); color: #fff; }
      .priority.soon    { background: var(--gs-medium-soft); color: var(--gs-medium); }
      .priority.planned { background: var(--gs-cool-soft); color: var(--gs-cool); }
      .actions strong { font-size: 0.95rem; color: var(--gs-text-strong); font-weight: 500; }
      .actions .rationale {
        margin: 0.3rem 0 0;
        font-size: 0.86rem;
        color: var(--gs-text-muted);
        line-height: 1.5;
      }

      .refs {
        display: flex;
        gap: 0.75rem;
        align-items: baseline;
        margin-top: 1.25rem;
        padding-top: 1rem;
        border-top: 1px dashed var(--gs-border);
        font-family: var(--gs-mono);
        font-size: 0.78rem;
        color: var(--gs-text-muted);
        flex-wrap: wrap;
      }
      .refs .eyebrow { margin: 0; }

      .rec-hint, .rec-error {
        margin: 0;
        font-size: 0.9rem;
        color: var(--gs-text-muted);
        line-height: 1.55;
        max-width: 65ch;
      }
      .rec-error { color: var(--gs-high); }

      .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.9rem;
        padding: 4rem 1rem;
        color: var(--gs-text-muted);
      }
      .loading p {
        margin: 0;
        font-size: 0.7rem;
        letter-spacing: 0.16em;
        color: var(--gs-text-faint);
      }

      @media (max-width: 900px) {
        .hero { grid-template-columns: 1fr; gap: 1.5rem; }
        .specs { grid-template-columns: repeat(3, 1fr); }
        .rec-grid { grid-template-columns: 1fr; gap: 1.5rem; }
      }
      @media (max-width: 540px) {
        .hero { padding: 1.25rem 1.25rem; }
        .specs { grid-template-columns: repeat(2, 1fr); }
      }
    `,
  ],
})
export class AssetDetailComponent {
  private readonly api = inject(ApiService);
  private readonly sse = inject(SseService);
  protected readonly i18n = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly BackIcon = ArrowLeft;
  protected readonly AlertIcon = AlertTriangle;
  protected readonly SparkIcon = Sparkles;
  protected readonly LoaderIcon = Loader2;
  protected readonly LiveIcon = CircleDot;
  protected readonly InertIcon = Circle;

  readonly id = input.required<string>();

  protected readonly asset = signal<Asset | null>(null);
  protected readonly readings = signal<TelemetryReading[]>([]);
  protected readonly alerts = signal<Alert[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly recommendation = signal<Recommendation | null>(null);
  protected readonly recLoading = signal(false);
  protected readonly recError = signal<string | null>(null);

  protected readonly models = signal<ModelOption[]>([]);
  protected readonly selectedModel = signal<string>(this.readStoredModel());

  protected readonly openAlerts = computed(() => this.alerts().filter((a) => a.status === 'open'));

  protected readonly bannerSeverity = computed(() => {
    const ranks = { critical: 4, high: 3, medium: 2, low: 1 } as const;
    let highest: keyof typeof ranks = 'low';
    let found = false;
    for (const a of this.openAlerts()) {
      if (!found || ranks[a.severity] > ranks[highest]) {
        highest = a.severity;
        found = true;
      }
    }
    return found ? highest : 'low';
  });

  constructor() {
    queueMicrotask(() => this.load());

    this.api.listModels().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (cat) => {
        this.models.set(cat.items);
        const stored = this.selectedModel();
        const validIds = new Set(cat.items.map((m) => m.id));
        if (!validIds.has(stored) && cat.items.length > 0) {
          this.selectedModel.set(cat.items[0]!.id);
        }
      },
    });
  }

  private load(): void {
    const id = this.id();

    this.api.getAsset(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (a) => {
        this.asset.set(a);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? err?.message ?? 'Unknown error');
        this.loading.set(false);
      },
    });

    this.api.getTelemetry(id, 120).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => this.readings.set(res.items),
    });

    this.api.listAlerts('all').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => this.alerts.set(res.items.filter((a) => a.assetId === id)),
    });

    this.sse.telemetry$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((r) => {
      if (r.assetId !== id) return;
      const next = [...this.readings(), r];
      if (next.length > 240) next.splice(0, next.length - 240);
      this.readings.set(next);
    });

    this.sse.alerts$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((al) => {
      if (al.assetId !== id) return;
      this.alerts.set([al, ...this.alerts()]);
    });
  }

  protected fetchRecommendation(): void {
    this.recLoading.set(true);
    this.recError.set(null);
    this.api.getRecommendation(this.id(), this.selectedModel()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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

  protected onModelChange(ev: Event): void {
    const target = ev.target as HTMLSelectElement;
    const id = target.value;
    this.selectedModel.set(id);
    try { localStorage.setItem(MODEL_STORAGE_KEY, id); } catch { /* private mode etc — non-fatal */ }
  }

  private readStoredModel(): string {
    try {
      const v = localStorage.getItem(MODEL_STORAGE_KEY);
      if (v && v.length > 0) return v;
    } catch { /* private mode etc — non-fatal */ }
    return 'anthropic/claude-sonnet-4.6';
  }

  protected typeLabel(t: Asset['assetType']): string {
    switch (t) {
      case 'distribution_transformer': return this.i18n.t('asset.type.distTransformerLong');
      case 'mv_lv_substation': return this.i18n.t('asset.type.substationLong');
      case 'feeder_breaker': return this.i18n.t('asset.type.feederBreakerLong');
    }
  }
}
