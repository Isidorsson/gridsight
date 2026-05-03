import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Hourglass } from 'lucide-angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SeverityBadgeComponent } from './severity-badge.component';
import { SparklineComponent } from './sparkline.component';
import { SseService } from '../core/sse.service';
import { LanguageService } from '../core/i18n/language.service';
import type { Alert, Asset, TelemetryReading } from '../core/types';

@Component({
  selector: 'gs-asset-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, RouterLink, LucideAngularModule, SeverityBadgeComponent, SparklineComponent],
  template: `
    <a class="card" [routerLink]="['/assets', asset().id]"
       [class.has-alert]="!!highestSeverity()"
       [attr.data-severity]="highestSeverity() ?? 'ok'">
      <div class="card-tag" aria-hidden="true">
        <span class="idx">{{ index() | number: '2.0-0' }}</span>
        <span class="line"></span>
      </div>

      <div class="card-body">
        <header>
          <div class="ident">
            <span class="kind">{{ typeLabel() }}</span>
            <h3>{{ asset().name }}</h3>
            <p class="id">{{ asset().id }}</p>
          </div>
          @if (highestSeverity()) {
            <gs-severity-badge [severity]="highestSeverity()!" />
          } @else {
            <span class="badge ok">
              <span class="dot"></span>{{ i18n.t('card.nominal') }}
            </span>
          }
        </header>

        <dl class="meta">
          <div>
            <dt>{{ i18n.t('card.rating') }}</dt>
            <dd>{{ ratingLabel() }}</dd>
          </div>
          <div>
            <dt>{{ i18n.t('card.voltage') }}</dt>
            <dd>{{ asset().primaryVoltageKv }}/{{ asset().secondaryVoltageKv }} kV</dd>
          </div>
          <div>
            <dt>{{ i18n.t('card.cool') }}</dt>
            <dd>{{ asset().coolingClass }}</dd>
          </div>
          <div class="loc">
            <dt>{{ i18n.t('card.location') }}</dt>
            <dd>{{ asset().locationName }}</dd>
          </div>
        </dl>

        @if (latest(); as r) {
          <div class="readings">
            <div class="reading">
              <span>{{ i18n.t('card.oil') }}</span>
              <strong [class.warn]="r.oilTempC >= 95" [class.alarm]="r.oilTempC >= 105">
                {{ r.oilTempC | number: '1.0-1' }}<em>°C</em>
              </strong>
            </div>
            <div class="reading">
              <span>{{ i18n.t('card.winding') }}</span>
              <strong [class.warn]="r.windingTempC >= 110" [class.alarm]="r.windingTempC >= 130">
                {{ r.windingTempC | number: '1.0-1' }}<em>°C</em>
              </strong>
            </div>
            <div class="reading">
              <span>{{ i18n.t('card.load') }}</span>
              <strong [class.warn]="r.loadFactor >= 1.0" [class.alarm]="r.loadFactor >= 1.2">
                {{ r.loadFactor * 100 | number: '1.0-0' }}<em>%</em>
              </strong>
            </div>
          </div>
          @if (oilHistory().length >= 2) {
            <div class="spark" aria-hidden="true">
              <gs-sparkline [values]="oilHistory()"
                            color="var(--gs-accent)"
                            [warn]="95"
                            [alarm]="105"
                            ariaLabel="Top-oil temperature history" />
              <span class="spark-label">{{ oilHistory().length }} {{ i18n.t('card.ticks') }}</span>
            </div>
          }
        } @else {
          <div class="readings empty">
            <i-lucide [img]="HourglassIcon" [size]="13" [strokeWidth]="1.6" aria-hidden="true"></i-lucide>
            {{ i18n.t('card.awaiting') }}
          </div>
        }
      </div>
    </a>
  `,
  styles: [
    `
      .card {
        --edge: var(--gs-border);
        position: relative;
        display: grid;
        grid-template-columns: 32px 1fr;
        background: var(--gs-surface);
        border: 1px solid var(--edge);
        border-radius: var(--gs-radius-2);
        color: var(--gs-text);
        overflow: hidden;
        transition: transform 0.15s, border-color 0.15s, background 0.15s, box-shadow 0.2s;
      }
      .card::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent 35%);
      }
      .card:hover {
        text-decoration: none;
        --edge: var(--gs-accent-line);
        transform: translateY(-1px);
        box-shadow: var(--gs-shadow-soft);
      }
      .card.has-alert[data-severity='critical'] { --edge: var(--gs-critical); }
      .card.has-alert[data-severity='high']     { --edge: var(--gs-high); }
      .card.has-alert[data-severity='medium']   { --edge: var(--gs-medium); }
      .card.has-alert[data-severity='low']      { --edge: var(--gs-low); }

      .card-tag {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0.85rem 0 0.85rem;
        background: var(--gs-bg-2);
        border-right: 1px solid var(--gs-border);
        font-family: var(--gs-mono);
      }
      .card-tag .idx {
        font-size: 0.66rem;
        letter-spacing: 0.06em;
        color: var(--gs-text-faint);
        font-variant-numeric: tabular-nums;
        writing-mode: vertical-rl;
        transform: rotate(180deg);
      }
      .card-tag .line {
        flex: 1;
        width: 1px;
        margin-top: 0.5rem;
        background: linear-gradient(180deg, var(--edge), transparent);
        min-height: 24px;
      }

      .card-body { padding: 1.05rem 1.2rem 1.1rem; }

      header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 0.85rem;
      }
      .ident { min-width: 0; }
      .kind {
        display: block;
        font-family: var(--gs-mono);
        font-size: 0.62rem;
        font-weight: 500;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--gs-accent);
        margin-bottom: 0.25rem;
      }
      h3 {
        margin: 0 0 0.15rem;
        font-size: 1rem;
        font-weight: 500;
        letter-spacing: -0.01em;
        color: var(--gs-text-strong);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .id {
        margin: 0;
        font-family: var(--gs-mono);
        font-size: 0.72rem;
        color: var(--gs-text-muted);
      }

      .meta {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        column-gap: 0.85rem;
        row-gap: 0.5rem;
        margin: 0 0 0.95rem;
        padding: 0.65rem 0;
        border-top: 1px solid var(--gs-border);
        border-bottom: 1px solid var(--gs-border);
      }
      .meta .loc { grid-column: 1 / -1; }
      .meta div { min-width: 0; }
      .meta dt {
        font-family: var(--gs-mono);
        font-size: 0.62rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--gs-text-faint);
        margin-bottom: 0.1rem;
      }
      .meta dd {
        margin: 0;
        font-size: 0.82rem;
        font-family: var(--gs-mono);
        color: var(--gs-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .readings {
        display: flex;
        gap: 1.1rem;
        align-items: flex-end;
      }
      .readings.empty {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        color: var(--gs-text-faint);
        font-family: var(--gs-mono);
        font-size: 0.74rem;
        letter-spacing: 0.04em;
        padding-top: 0.2rem;
      }
      .reading { display: flex; flex-direction: column; gap: 0.2rem; }
      .reading span {
        font-family: var(--gs-mono);
        font-size: 0.6rem;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: var(--gs-text-faint);
      }
      .reading strong {
        font-family: var(--gs-mono);
        font-size: 1.18rem;
        font-weight: 500;
        line-height: 1;
        font-variant-numeric: tabular-nums;
        color: var(--gs-text-strong);
      }
      .reading strong em {
        font-style: normal;
        margin-left: 0.18em;
        font-size: 0.65em;
        color: var(--gs-text-faint);
        font-weight: 400;
      }
      .reading strong.warn  { color: var(--gs-medium); }
      .reading strong.alarm { color: var(--gs-high); }

      .spark {
        margin-top: 0.7rem;
        padding-top: 0.55rem;
        border-top: 1px dashed var(--gs-border);
        display: flex;
        align-items: center;
        gap: 0.65rem;
      }
      .spark gs-sparkline {
        flex: 1;
        height: 26px;
        display: block;
      }
      .spark-label {
        font-family: var(--gs-mono);
        font-size: 0.6rem;
        letter-spacing: 0.1em;
        color: var(--gs-text-faint);
        text-transform: uppercase;
        font-variant-numeric: tabular-nums;
      }

      .badge.ok {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        background: var(--gs-low-soft);
        color: var(--gs-low);
        padding: 0.2rem 0.55rem;
        border-radius: 4px;
        font-family: var(--gs-mono);
        font-size: 0.66rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        border: 1px solid rgba(74, 222, 128, 0.25);
      }
      .badge.ok .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--gs-low);
        box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.18);
      }
    `,
  ],
})
export class AssetCardComponent {
  readonly asset = input.required<Asset>();
  readonly latest = input<TelemetryReading | null>(null);
  readonly alerts = input<Alert[]>([]);
  readonly index = input<number>(0);

  private readonly sse = inject(SseService);
  protected readonly i18n = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly HourglassIcon = Hourglass;
  protected readonly oilHistory = signal<number[]>([]);

  constructor() {
    // Per-card sparkline window. We subscribe directly to SSE rather than
    // chaining off `latest()` so we don't double-count the parent's update.
    this.sse.telemetry$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => {
        if (r.assetId !== this.asset().id) return;
        this.append(r.oilTempC);
      });
  }

  private append(value: number): void {
    const next = [...this.oilHistory(), value];
    if (next.length > 30) next.splice(0, next.length - 30);
    this.oilHistory.set(next);
  }

  readonly typeLabel = computed(() => {
    switch (this.asset().assetType) {
      case 'distribution_transformer': return this.i18n.t('card.type.distTransformer');
      case 'mv_lv_substation': return this.i18n.t('card.type.substation');
      case 'feeder_breaker': return this.i18n.t('card.type.feederBreaker');
    }
  });

  readonly ratingLabel = computed(() => {
    const a = this.asset();
    if (a.assetType === 'feeder_breaker') return `${a.primaryVoltageKv} kV`;
    return `${a.ratedPowerKva} kVA`;
  });

  readonly highestSeverity = computed(() => {
    const ranks = { critical: 4, high: 3, medium: 2, low: 1 } as const;
    let highest: keyof typeof ranks | null = null;
    for (const a of this.alerts()) {
      if (a.status !== 'open') continue;
      if (!highest || ranks[a.severity] > ranks[highest]) {
        highest = a.severity;
      }
    }
    return highest;
  });
}
