import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeverityBadgeComponent } from './severity-badge.component';
import type { Alert, Asset, TelemetryReading } from '../core/types';

@Component({
  selector: 'gs-asset-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SeverityBadgeComponent],
  template: `
    <a class="card" [routerLink]="['/assets', asset().id]">
      <header>
        <div>
          <h3>{{ asset().name }}</h3>
          <p class="id">{{ asset().id }}</p>
        </div>
        @if (highestSeverity()) {
          <gs-severity-badge [severity]="highestSeverity()!" />
        } @else {
          <span class="badge ok">healthy</span>
        }
      </header>

      <dl class="meta">
        <div><dt>Type</dt><dd>{{ typeLabel() }}</dd></div>
        <div><dt>Rating</dt><dd>{{ ratingLabel() }}</dd></div>
        <div><dt>Location</dt><dd>{{ asset().locationName }}</dd></div>
      </dl>

      @if (latest(); as r) {
        <div class="readings">
          <div class="reading"><span>Oil</span><strong>{{ r.oilTempC | number: '1.0-1' }} °C</strong></div>
          <div class="reading"><span>Winding</span><strong>{{ r.windingTempC | number: '1.0-1' }} °C</strong></div>
          <div class="reading"><span>Load</span><strong>{{ r.loadFactor * 100 | number: '1.0-0' }}%</strong></div>
        </div>
      } @else {
        <div class="readings empty">awaiting first reading…</div>
      }
    </a>
  `,
  styles: [
    `
      .card {
        display: block;
        padding: 1.1rem 1.2rem;
        border-radius: 12px;
        background: var(--gs-surface);
        border: 1px solid var(--gs-border);
        color: var(--gs-text);
        transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
      }
      .card:hover {
        text-decoration: none;
        border-color: var(--gs-accent);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.06);
      }
      header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 0.85rem;
      }
      h3 {
        margin: 0 0 0.15rem;
        font-size: 1rem;
        font-weight: 600;
      }
      .id {
        margin: 0;
        font-family: var(--gs-mono);
        font-size: 0.78rem;
        color: var(--gs-text-muted);
      }
      .meta {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 0.4rem 0.75rem;
        margin: 0 0 0.85rem;
        padding: 0.5rem 0;
        border-top: 1px solid var(--gs-border);
      }
      .meta div { min-width: 0; }
      .meta dt {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--gs-text-muted);
        margin-bottom: 0.15rem;
      }
      .meta dd {
        margin: 0;
        font-size: 0.85rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .readings {
        display: flex;
        gap: 0.85rem;
        padding-top: 0.5rem;
        border-top: 1px solid var(--gs-border);
      }
      .readings.empty { color: var(--gs-text-muted); font-size: 0.8rem; }
      .reading {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
      }
      .reading span {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--gs-text-muted);
      }
      .reading strong {
        font-family: var(--gs-mono);
        font-size: 0.95rem;
        font-weight: 500;
      }
      .badge.ok {
        background: rgba(22, 163, 74, 0.15);
        color: var(--gs-low);
        padding: 0.18rem 0.55rem;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
    `,
  ],
})
export class AssetCardComponent {
  readonly asset = input.required<Asset>();
  readonly latest = input<TelemetryReading | null>(null);
  readonly alerts = input<Alert[]>([]);

  readonly typeLabel = computed(() => {
    switch (this.asset().assetType) {
      case 'distribution_transformer': return 'Dist. Transformer';
      case 'mv_lv_substation': return 'Substation';
      case 'feeder_breaker': return 'Feeder Breaker';
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
