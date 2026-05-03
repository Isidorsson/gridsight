import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule, Loader2, Filter, Check, Activity } from 'lucide-angular';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { SseService } from '../../core/sse.service';
import { LanguageService } from '../../core/i18n/language.service';
import { AssetCardComponent } from '../../shared/asset-card.component';
import { EmptyStateComponent } from '../../shared/empty-state.component';
import { FleetMapComponent } from '../../shared/fleet-map.component';
import type { Alert, Asset, Severity, TelemetryReading } from '../../core/types';

type FilterMode = 'all' | 'with_alerts';

@Component({
  selector: 'gs-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule, AssetCardComponent, EmptyStateComponent, FleetMapComponent],
  template: `
    <section class="page-head">
      <span class="eyebrow">{{ i18n.t('dashboard.eyebrow') }}</span>
      <h1>
        {{ i18n.t('dashboard.headline.prefix') }} <span class="hl">{{ assets().length || '—' }}</span> {{ i18n.t('dashboard.headline.suffix') }}
      </h1>
      <p class="lede">{{ i18n.t('dashboard.lede') }}</p>
    </section>

    <section class="status-board" aria-label="Fleet at a glance">
      <button type="button" class="stat" [class.active]="filter() === 'all'" (click)="filter.set('all')">
        <span class="stat-label">{{ i18n.t('dashboard.stat.total') }}</span>
        <span class="stat-value">{{ assets().length || '00' }}</span>
        <span class="stat-foot">
          <i-lucide [img]="filter() === 'all' ? CheckIcon : FilterIcon" [size]="11" [strokeWidth]="2"></i-lucide>
          {{ filter() === 'all' ? i18n.t('dashboard.showingAll') : i18n.t('dashboard.showAll') }}
        </span>
      </button>
      <button type="button" class="stat alert" [class.active]="filter() === 'with_alerts'"
              [class.has]="assetsWithAlerts().length > 0" (click)="filter.set('with_alerts')">
        <span class="stat-label">{{ i18n.t('dashboard.stat.openAlerts') }}</span>
        <span class="stat-value">{{ assetsWithAlerts().length || '00' }}</span>
        <span class="stat-foot">
          <i-lucide [img]="filter() === 'with_alerts' ? CheckIcon : FilterIcon" [size]="11" [strokeWidth]="2"></i-lucide>
          {{ filter() === 'with_alerts' ? i18n.t('dashboard.filtered') : i18n.t('dashboard.clickFilter') }}
        </span>
      </button>
      <div class="stat tally">
        <span class="stat-label">{{ i18n.t('dashboard.stat.bySeverity') }}</span>
        <div class="severity-tally">
          <span class="sev-dot critical" [class.zero]="!severityCounts().critical">
            <strong>{{ severityCounts().critical | number: '2.0-0' }}</strong>
            <span>{{ i18n.t('dashboard.sev.critical') }}</span>
          </span>
          <span class="sev-dot high" [class.zero]="!severityCounts().high">
            <strong>{{ severityCounts().high | number: '2.0-0' }}</strong>
            <span>{{ i18n.t('dashboard.sev.high') }}</span>
          </span>
          <span class="sev-dot medium" [class.zero]="!severityCounts().medium">
            <strong>{{ severityCounts().medium | number: '2.0-0' }}</strong>
            <span>{{ i18n.t('dashboard.sev.medium') }}</span>
          </span>
          <span class="sev-dot low" [class.zero]="!severityCounts().low">
            <strong>{{ severityCounts().low | number: '2.0-0' }}</strong>
            <span>{{ i18n.t('dashboard.sev.low') }}</span>
          </span>
        </div>
      </div>
      <div class="stat live">
        <span class="stat-label">{{ i18n.t('dashboard.stat.stream') }}</span>
        <span class="stat-value live-value">
          <span class="ind" [class.on]="sse.connected()"></span>
          {{ sse.connected() ? i18n.t('dashboard.stream.live') : i18n.t('dashboard.stream.offline') }}
        </span>
        <span class="stat-foot">{{ readingsReceived() | number: '1.0-0' }} {{ i18n.t('dashboard.readingsRcvd') }}</span>
      </div>
    </section>

    <section class="map-section" aria-label="Fleet map">
      <gs-fleet-map [assets]="assets()" [alertsByAsset]="alertsByAsset()" (select)="onMapSelect($event)" />
    </section>

    <section class="page-body">
      <header class="section-head">
        <span class="eyebrow">{{ filter() === 'with_alerts' ? i18n.t('dashboard.section.filteredEyebrow') : i18n.t('dashboard.section.allEyebrow') }} · {{ visibleAssets().length | number: '2.0-0' }}</span>
        <h2>{{ filter() === 'with_alerts' ? i18n.t('dashboard.section.title.attention') : i18n.t('dashboard.section.title.roster') }}</h2>
      </header>

      @if (loading()) {
        <div class="loading">
          <i-lucide [img]="LoaderIcon" class="gs-spin" [size]="22" [strokeWidth]="1.6"></i-lucide>
          <p class="mono">{{ i18n.t('dashboard.loading.connecting') }}</p>
        </div>
      } @else if (error()) {
        <gs-empty-state icon="error_outline" [title]="i18n.t('dashboard.empty.couldNotLoad')" [description]="error()!" />
      } @else if (visibleAssets().length === 0) {
        <gs-empty-state icon="check_circle"
                        [title]="filter() === 'with_alerts' ? i18n.t('dashboard.empty.noAlerts') : i18n.t('dashboard.empty.noAssets')"
                        [description]="filter() === 'with_alerts' ? i18n.t('dashboard.empty.noAlerts.desc') : i18n.t('dashboard.empty.noAssets.desc')" />
      } @else {
        <div class="grid">
          @for (a of visibleAssets(); track a.id; let i = $index) {
            <gs-asset-card [asset]="a"
                           [latest]="latestByAsset().get(a.id) ?? null"
                           [alerts]="alertsByAsset().get(a.id) ?? []"
                           [index]="i + 1" />
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      .page-head {
        margin-bottom: 2rem;
        max-width: 70ch;
      }
      .page-head h1 {
        margin: 0.6rem 0 0.65rem;
        font-size: clamp(1.45rem, 2.2vw, 2rem);
        font-weight: 500;
        line-height: 1.18;
        letter-spacing: -0.018em;
        color: var(--gs-text-strong);
      }
      .page-head h1 .hl {
        font-family: var(--gs-mono);
        font-size: 0.85em;
        color: var(--gs-text-strong);
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        padding: 0 0.2em;
        background-image: linear-gradient(var(--gs-brand), var(--gs-brand));
        background-repeat: no-repeat;
        background-size: 100% 0.42em;
        background-position: 0 88%;
      }
      .page-head .lede {
        margin: 0;
        color: var(--gs-text-muted);
        font-size: 0.95rem;
        max-width: 60ch;
      }

      .status-board {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 1px;
        margin-bottom: 2rem;
        border-radius: var(--gs-radius-2);
        overflow: hidden;
        background: var(--gs-border);
        border: 1px solid var(--gs-border);
      }
      .stat {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 0.6rem;
        padding: 1.1rem 1.25rem 0.95rem;
        background: var(--gs-surface);
        text-align: left;
        border: 0;
        font-family: inherit;
        color: inherit;
        cursor: pointer;
        transition: background 0.15s;
        min-height: 110px;
      }
      .stat[type='button']:hover {
        background: var(--gs-surface-2);
      }
      .stat.active {
        background:
          linear-gradient(180deg, var(--gs-brand-soft), transparent 80%),
          var(--gs-surface);
        box-shadow: inset 0 2px 0 var(--gs-brand);
      }
      .stat-label {
        font-family: var(--gs-mono);
        font-size: 0.66rem;
        font-weight: 500;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--gs-text-faint);
      }
      .stat-value {
        font-family: var(--gs-mono);
        font-size: 2.1rem;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        line-height: 1;
        color: var(--gs-text-strong);
        letter-spacing: -0.02em;
      }
      .stat.alert.has .stat-value { color: var(--gs-medium); }
      .stat.active .stat-value { color: var(--gs-accent-bright); }
      .stat-foot {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-family: var(--gs-mono);
        font-size: 0.7rem;
        color: var(--gs-text-muted);
        letter-spacing: 0.04em;
      }
      .stat.active .stat-foot { color: var(--gs-accent); }
      .stat.tally { cursor: default; }
      .severity-tally {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.4rem 0.85rem;
      }
      .severity-tally .sev-dot {
        display: inline-flex;
        align-items: baseline;
        gap: 0.4rem;
        font-family: var(--gs-mono);
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--gs-text-muted);
      }
      .severity-tally .sev-dot strong {
        font-size: 0.95rem;
        font-weight: 500;
        color: var(--gs-text);
        font-variant-numeric: tabular-nums;
      }
      .severity-tally .sev-dot.zero { opacity: 0.3; }
      .severity-tally .sev-dot.critical strong { color: var(--gs-critical); }
      .severity-tally .sev-dot.high strong     { color: var(--gs-high); }
      .severity-tally .sev-dot.medium strong   { color: var(--gs-medium); }
      .severity-tally .sev-dot.low strong      { color: var(--gs-low); }

      .stat.live { cursor: default; }
      .live-value {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        font-size: 1.35rem;
        letter-spacing: 0.05em;
        color: var(--gs-text-muted);
      }
      .live-value .ind {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--gs-text-faint);
      }
      .live-value .ind.on {
        background: var(--gs-low);
        box-shadow: 0 0 0 4px rgba(74,222,128,0.18);
        animation: gs-pulse 2.6s ease-in-out infinite;
      }

      .section-head {
        display: flex;
        align-items: baseline;
        gap: 0.85rem;
        margin: 0 0 1.25rem;
        padding-bottom: 0.65rem;
        border-bottom: 1px solid var(--gs-border);
      }
      .section-head h2 {
        margin: 0;
        font-size: 1rem;
        font-weight: 500;
        letter-spacing: -0.01em;
        color: var(--gs-text);
      }

      .map-section {
        margin-bottom: 1.5rem;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
        gap: 1rem;
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

      @media (max-width: 980px) {
        .status-board { grid-template-columns: 1fr 1fr; }
      }
      @media (max-width: 540px) {
        .status-board { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class DashboardComponent {
  private readonly api = inject(ApiService);
  protected readonly sse = inject(SseService);
  protected readonly i18n = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly assets = signal<Asset[]>([]);
  protected readonly latestByAsset = signal<Map<string, TelemetryReading>>(new Map());
  protected readonly alertsByAsset = signal<Map<string, Alert[]>>(new Map());
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly filter = signal<FilterMode>('all');
  protected readonly readingsReceived = signal(0);

  protected readonly LoaderIcon = Loader2;
  protected readonly FilterIcon = Filter;
  protected readonly CheckIcon = Check;
  protected readonly ActivityIcon = Activity;

  protected readonly assetsWithAlerts = computed(() =>
    this.assets().filter((a) => (this.alertsByAsset().get(a.id)?.length ?? 0) > 0),
  );

  protected readonly visibleAssets = computed(() =>
    this.filter() === 'with_alerts' ? this.assetsWithAlerts() : this.assets(),
  );

  protected readonly severityCounts = computed(() => {
    const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const list of this.alertsByAsset().values()) {
      for (const a of list) {
        if (a.status === 'open') counts[a.severity] += 1;
      }
    }
    return counts;
  });

  constructor() {
    this.api
      .listAssets()
      .pipe(takeUntilDestroyed(this.destroyRef))
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
      .pipe(takeUntilDestroyed(this.destroyRef))
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

    this.sse.telemetry$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((reading) => {
      const next = new Map(this.latestByAsset());
      next.set(reading.assetId, reading);
      this.latestByAsset.set(next);
      this.readingsReceived.update((n) => n + 1);
    });

    this.sse.alerts$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((alert) => {
      const next = new Map(this.alertsByAsset());
      const list = next.get(alert.assetId) ?? [];
      next.set(alert.assetId, [alert, ...list]);
      this.alertsByAsset.set(next);
    });
  }

  protected onMapSelect(asset: Asset): void {
    void this.router.navigate(['/assets', asset.id]);
  }
}
