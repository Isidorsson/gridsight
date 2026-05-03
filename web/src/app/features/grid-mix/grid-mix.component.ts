import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule, Loader2, Wind, Zap, Leaf, Flame, RefreshCcw } from 'lucide-angular';
import { ApiService } from '../../core/api.service';
import { DonutChartComponent, type DonutSlice } from '../../shared/donut-chart.component';
import { SparklineComponent } from '../../shared/sparkline.component';
import { fuelColor } from '../../shared/fuel';
import type { BiddingZone, DataSource, DayAheadPrices, GenerationMix, ZoneSummary } from '../../core/types';

const SOURCE_STORAGE_KEY = 'gs.grid.source';

@Component({
  selector: 'gs-grid-mix',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule, DonutChartComponent, SparklineComponent],
  template: `
    <section class="page-head">
      <span class="eyebrow">European Grid · 03 Live mix</span>
      <h1>
        How fossil-free is the grid <span class="hl">right now</span>?
      </h1>
      <p class="lede">
        Generation mix and day-ahead prices across the European bidding zones, sourced from the
        <a href="https://api.energy-charts.info" target="_blank" rel="noopener">Energy-Charts API</a>
        (Fraunhofer ISE). Switch zones to compare a hydro/nuclear backbone (Sweden, Norway, France)
        against fossil-heavy markets (Poland, Netherlands).
      </p>
    </section>

    <div class="source-bar" role="group" aria-label="Data source">
      <span class="src-lbl mono">DATA SOURCE</span>
      <div class="src-toggle">
        @for (s of sourceOptions; track s.value) {
          <button type="button"
                  class="src-btn"
                  [class.active]="source() === s.value"
                  (click)="setSource(s.value)"
                  [attr.aria-pressed]="source() === s.value"
                  [title]="s.hint">
            <span class="src-dot" [class]="s.value"></span>
            {{ s.label }}
          </button>
        }
      </div>
      <span class="src-hint mono">
        @if (source() === 'auto') { Live first, mock fallback }
        @else if (source() === 'live') { Energy-Charts (Fraunhofer ISE) }
        @else { Synthetic, deterministic }
      </span>
    </div>

    <nav class="zone-tabs" aria-label="Bidding zones">
      @for (z of zones(); track z.code) {
        <button type="button" class="zone-tab"
                [class.active]="z.code === selected()"
                (click)="selectZone(z.code)"
                [attr.aria-pressed]="z.code === selected()">
          <span class="flag" aria-hidden="true">{{ flagEmoji(z.country) }}</span>
          <span class="lbl">{{ z.label }}</span>
        </button>
      }
    </nav>

    @if (loading()) {
      <div class="loading">
        <i-lucide [img]="LoaderIcon" class="gs-spin" [size]="22" [strokeWidth]="1.6"></i-lucide>
        <p class="mono">FETCHING ENTSO-E DATA…</p>
      </div>
    } @else if (error()) {
      <p class="err">Could not load grid data — {{ error() }}</p>
    } @else if (mix()) {
      @if (mix(); as m) {
      <section class="kpi-row">
        <div class="kpi">
          <span class="lbl">Total generation</span>
          <span class="val">{{ formatMw(m.totalMw) }}</span>
          <span class="unit">at {{ formatTime(m.ts) }}</span>
        </div>
        <div class="kpi" [class.alarm]="m.fossilFreeShare < 0.5"
                          [class.warn]="m.fossilFreeShare >= 0.5 && m.fossilFreeShare < 0.85"
                          [class.good]="m.fossilFreeShare >= 0.85">
          <span class="lbl">
            <i-lucide [img]="LeafIcon" [size]="11" [strokeWidth]="2" aria-hidden="true"></i-lucide>
            Fossil-free share
          </span>
          <span class="val">{{ m.fossilFreeShare * 100 | number: '1.0-1' }}<em>%</em></span>
          <span class="unit">{{ fossilFreeMw(m) }} clean</span>
        </div>
        <div class="kpi" [class.alarm]="currentPrice() > 100" [class.warn]="currentPrice() > 60 && currentPrice() <= 100">
          <span class="lbl">
            <i-lucide [img]="ZapIcon" [size]="11" [strokeWidth]="2" aria-hidden="true"></i-lucide>
            Day-ahead — now
          </span>
          <span class="val">{{ currentPrice() | number: '1.2-2' }}<em>€/MWh</em></span>
          <span class="unit">{{ priceTrendLabel() }}</span>
        </div>
        <div class="kpi">
          <span class="lbl">
            <i-lucide [img]="topFuelIcon()" [size]="11" [strokeWidth]="2" aria-hidden="true"></i-lucide>
            Lead source
          </span>
          <span class="val small">{{ m.slices[0]?.label ?? '—' }}</span>
          <span class="unit">{{ leadShare() | number: '1.0-1' }}% of mix</span>
        </div>
      </section>

      <div class="grid-2">
        <section class="panel mix-panel">
          <header class="section-head">
            <span class="eyebrow">Generation mix</span>
            <h2>By fuel · MW</h2>
            <span class="src" [class.live]="m.source === 'live'">{{ sourceLabel(m.source) }}</span>
          </header>
          <gs-donut-chart
            [slices]="donutSlices()"
            [centerValue]="(m.fossilFreeShare * 100 | number: '1.0-1') + '%'"
            centerLabel="FOSSIL-FREE"
            [ariaLabel]="'Generation mix donut for ' + zoneLabel(m.zone)" />
        </section>

        <section class="panel price-panel">
          <header class="section-head">
            <span class="eyebrow">Day-ahead price</span>
            <h2>Hourly · today</h2>
            @if (prices(); as p) {
              <span class="src" [class.live]="p.source === 'live'">{{ sourceLabel(p.source) }}</span>
            }
          </header>
          @if (prices(); as p) {
            <div class="price-summary">
              <div class="ps-stat">
                <span class="lbl">Min</span>
                <strong>{{ minPrice() | number: '1.2-2' }}</strong>
                <em>€/MWh</em>
              </div>
              <div class="ps-stat">
                <span class="lbl">Avg</span>
                <strong>{{ avgPrice() | number: '1.2-2' }}</strong>
                <em>€/MWh</em>
              </div>
              <div class="ps-stat">
                <span class="lbl">Max</span>
                <strong>{{ maxPrice() | number: '1.2-2' }}</strong>
                <em>€/MWh</em>
              </div>
            </div>

            <div class="price-chart">
              <gs-sparkline
                [values]="priceValues()"
                color="var(--gs-accent)"
                [ariaLabel]="'24h day-ahead price for ' + zoneLabel(m.zone)" />
              <div class="hour-axis" aria-hidden="true">
                <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
              </div>
            </div>
          } @else {
            <p class="empty mono">NO PRICE DATA</p>
          }
        </section>
      </div>

      <section class="panel compare-panel">
        <header class="section-head">
          <span class="eyebrow">Cross-zone comparison</span>
          <h2>Fossil-free share &amp; current price · {{ summaries().length }} zones</h2>
          <button type="button" class="refresh" (click)="reload()" [disabled]="reloading()">
            <i-lucide [img]="reloading() ? LoaderIcon : RefreshIcon"
                      [class.gs-spin]="reloading()" [size]="12" [strokeWidth]="2" aria-hidden="true"></i-lucide>
            REFRESH
          </button>
        </header>
        <ul class="compare-grid">
          @for (s of sortedSummaries(); track s.zone) {
            <li class="zoneline" [class.selected]="s.zone === selected()" (click)="selectZone(s.zone)">
              <div class="zoneline-head">
                <span class="flag" aria-hidden="true">{{ flagEmoji(s.country) }}</span>
                <span class="lbl">{{ shortZone(s.label) }}</span>
                <span class="price mono">{{ s.currentPrice | number: '1.0-0' }} €</span>
              </div>
              <div class="bar" [class.high]="s.fossilFreeShare >= 0.85"
                                [class.mid]="s.fossilFreeShare >= 0.5 && s.fossilFreeShare < 0.85"
                                [class.low]="s.fossilFreeShare < 0.5">
                <span class="fill" [style.width.%]="s.fossilFreeShare * 100"></span>
                <span class="bar-lbl mono">{{ s.fossilFreeShare * 100 | number: '1.0-0' }}% clean</span>
              </div>
              <div class="zoneline-foot mono">
                {{ formatMw(s.totalMw) }} · top: {{ s.topFuel.label }}
              </div>
            </li>
          }
        </ul>
      </section>
      }
    }
  `,
  styles: [
    `
      .page-head { margin-bottom: 1.6rem; max-width: 70ch; }
      .page-head h1 {
        margin: 0.6rem 0 0.65rem;
        font-size: clamp(1.45rem, 2.2vw, 2rem);
        font-weight: 500;
        line-height: 1.18;
        letter-spacing: -0.018em;
        color: var(--gs-text-strong);
      }
      .page-head h1 .hl {
        color: var(--gs-accent);
        font-family: var(--gs-mono);
        font-size: 0.9em;
        font-weight: 500;
        padding: 0 0.1em;
        border-bottom: 1px solid var(--gs-accent-line);
      }
      .page-head .lede {
        margin: 0;
        color: var(--gs-text-muted);
        font-size: 0.95rem;
        max-width: 64ch;
      }

      .source-bar {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        padding: 0.7rem 0.95rem;
        margin-bottom: 1rem;
        background: var(--gs-surface);
        border: 1px solid var(--gs-border);
        border-radius: var(--gs-radius);
        flex-wrap: wrap;
      }
      .src-lbl {
        font-family: var(--gs-mono);
        font-size: 0.62rem;
        letter-spacing: 0.16em;
        color: var(--gs-text-faint);
      }
      .src-toggle {
        display: inline-flex;
        background: var(--gs-bg-2);
        border: 1px solid var(--gs-border);
        border-radius: 6px;
        overflow: hidden;
      }
      .src-btn {
        appearance: none;
        background: transparent;
        border: 0;
        padding: 0.42rem 0.85rem;
        font-family: var(--gs-mono);
        font-size: 0.7rem;
        letter-spacing: 0.14em;
        font-weight: 500;
        color: var(--gs-text-muted);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        border-right: 1px solid var(--gs-border);
        transition: background 0.15s, color 0.15s;
      }
      .src-btn:last-child { border-right: 0; }
      .src-btn:hover { background: var(--gs-surface-2); color: var(--gs-text); }
      .src-btn.active {
        background: var(--gs-accent-soft);
        color: var(--gs-accent-bright);
      }
      .src-dot {
        width: 6px; height: 6px;
        border-radius: 50%;
        background: var(--gs-text-faint);
      }
      .src-dot.auto { background: var(--gs-accent); }
      .src-dot.live { background: var(--gs-low); box-shadow: 0 0 0 2px rgba(74,222,128,0.18); }
      .src-dot.mock { background: var(--gs-cool); }
      .src-hint {
        margin-left: auto;
        font-size: 0.66rem;
        color: var(--gs-text-faint);
        letter-spacing: 0.06em;
      }

      .zone-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin-bottom: 1.4rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--gs-border);
      }
      .zone-tab {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 0.75rem;
        font-family: var(--gs-mono);
        font-size: 0.74rem;
        letter-spacing: 0.06em;
        background: var(--gs-surface);
        color: var(--gs-text-muted);
        border: 1px solid var(--gs-border);
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.15s, color 0.15s, border-color 0.15s;
      }
      .zone-tab:hover { background: var(--gs-surface-2); color: var(--gs-text); }
      .zone-tab.active {
        background: var(--gs-accent-soft);
        color: var(--gs-accent-bright);
        border-color: var(--gs-accent-line);
      }
      .zone-tab .flag { font-size: 1rem; line-height: 1; }
      .zone-tab .lbl { font-weight: 500; }

      .kpi-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 1px;
        margin-bottom: 1.4rem;
        background: var(--gs-border);
        border: 1px solid var(--gs-border);
        border-radius: var(--gs-radius-2);
        overflow: hidden;
      }
      .kpi {
        background: var(--gs-surface);
        padding: 1rem 1.2rem;
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
      }
      .kpi .lbl {
        font-family: var(--gs-mono);
        font-size: 0.66rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--gs-text-faint);
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
      }
      .kpi .val {
        font-family: var(--gs-mono);
        font-size: 1.7rem;
        font-weight: 500;
        color: var(--gs-text-strong);
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.02em;
      }
      .kpi .val.small { font-size: 1.05rem; line-height: 1.15; }
      .kpi .val em {
        margin-left: 0.2em;
        font-size: 0.55em;
        font-weight: 400;
        color: var(--gs-text-faint);
        font-style: normal;
      }
      .kpi .unit {
        font-family: var(--gs-mono);
        font-size: 0.7rem;
        letter-spacing: 0.04em;
        color: var(--gs-text-muted);
      }
      .kpi.good .val { color: var(--gs-low); }
      .kpi.warn .val { color: var(--gs-medium); }
      .kpi.alarm .val { color: var(--gs-high); }

      .grid-2 {
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
        gap: 1rem;
        margin-bottom: 1.4rem;
      }
      .panel {
        background: var(--gs-surface);
        border: 1px solid var(--gs-border);
        border-radius: var(--gs-radius-2);
        padding: 1.25rem 1.4rem 1.4rem;
      }
      .section-head {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        margin-bottom: 1rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--gs-divider);
      }
      .section-head h2 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 500;
        letter-spacing: -0.01em;
        color: var(--gs-text);
      }
      .section-head .src {
        margin-left: auto;
        font-family: var(--gs-mono);
        font-size: 0.62rem;
        letter-spacing: 0.16em;
        padding: 0.22rem 0.5rem;
        border: 1px solid var(--gs-border);
        border-radius: 4px;
        color: var(--gs-text-muted);
        background: var(--gs-bg-2);
      }
      .section-head .src.live {
        color: var(--gs-low);
        border-color: rgba(74, 222, 128, 0.35);
        background: var(--gs-low-soft);
      }

      .price-summary {
        display: flex;
        gap: 1.5rem;
        margin-bottom: 0.6rem;
        flex-wrap: wrap;
      }
      .ps-stat {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }
      .ps-stat .lbl {
        font-family: var(--gs-mono);
        font-size: 0.62rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--gs-text-faint);
      }
      .ps-stat strong {
        font-family: var(--gs-mono);
        font-size: 1.05rem;
        font-weight: 500;
        color: var(--gs-text);
        font-variant-numeric: tabular-nums;
      }
      .ps-stat em {
        font-style: normal;
        font-family: var(--gs-mono);
        font-size: 0.66rem;
        color: var(--gs-text-faint);
      }
      .price-chart { position: relative; height: 140px; }
      .price-chart gs-sparkline { display: block; height: 100%; width: 100%; }
      .hour-axis {
        display: flex;
        justify-content: space-between;
        margin-top: 0.3rem;
        font-family: var(--gs-mono);
        font-size: 0.62rem;
        letter-spacing: 0.06em;
        color: var(--gs-text-faint);
      }
      .empty { color: var(--gs-text-faint); }

      .compare-panel { padding-bottom: 1rem; }
      .refresh {
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.32rem 0.6rem;
        background: var(--gs-bg-2);
        border: 1px solid var(--gs-border);
        border-radius: 4px;
        font-family: var(--gs-mono);
        font-size: 0.66rem;
        letter-spacing: 0.14em;
        color: var(--gs-text-muted);
        cursor: pointer;
      }
      .refresh:hover:not(:disabled) { border-color: var(--gs-accent-line); color: var(--gs-accent); }
      .refresh:disabled { opacity: 0.55; cursor: progress; }

      .compare-grid {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 0.75rem;
      }
      .zoneline {
        background: var(--gs-bg-2);
        border: 1px solid var(--gs-border);
        border-radius: var(--gs-radius);
        padding: 0.75rem 0.85rem 0.7rem;
        cursor: pointer;
        transition: border-color 0.15s, background 0.15s, transform 0.1s;
      }
      .zoneline:hover { border-color: var(--gs-accent-line); }
      .zoneline.selected {
        border-color: var(--gs-accent);
        background: var(--gs-accent-soft);
      }
      .zoneline-head {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        margin-bottom: 0.5rem;
      }
      .zoneline-head .flag { font-size: 1.05rem; line-height: 1; }
      .zoneline-head .lbl {
        font-size: 0.78rem;
        font-weight: 500;
        color: var(--gs-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
      }
      .zoneline-head .price {
        font-size: 0.74rem;
        color: var(--gs-text-strong);
        font-variant-numeric: tabular-nums;
      }
      .bar {
        position: relative;
        height: 8px;
        background: var(--gs-surface);
        border-radius: 999px;
        overflow: hidden;
        margin-bottom: 0.5rem;
        border: 1px solid var(--gs-border);
      }
      .bar .fill {
        position: absolute;
        inset: 0 auto 0 0;
        background: var(--gs-low);
        transition: width 0.4s ease;
      }
      .bar.mid .fill { background: var(--gs-medium); }
      .bar.low .fill { background: var(--gs-high); }
      .bar-lbl {
        position: absolute;
        right: 6px;
        top: -16px;
        font-size: 0.6rem;
        letter-spacing: 0.08em;
        color: var(--gs-text-faint);
      }
      .zoneline-foot {
        font-size: 0.66rem;
        color: var(--gs-text-faint);
        letter-spacing: 0.06em;
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
      .err {
        background: var(--gs-high-soft);
        color: var(--gs-high);
        padding: 0.75rem 1rem;
        border: 1px solid var(--gs-high);
        border-radius: var(--gs-radius);
        font-size: 0.85rem;
      }

      @media (max-width: 980px) {
        .kpi-row { grid-template-columns: repeat(2, 1fr); }
        .grid-2 { grid-template-columns: 1fr; }
      }
      @media (max-width: 540px) {
        .kpi-row { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class GridMixComponent {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly LoaderIcon = Loader2;
  protected readonly LeafIcon = Leaf;
  protected readonly ZapIcon = Zap;
  protected readonly WindIcon = Wind;
  protected readonly FlameIcon = Flame;
  protected readonly RefreshIcon = RefreshCcw;

  protected readonly zones = signal<BiddingZone[]>([]);
  protected readonly summaries = signal<ZoneSummary[]>([]);
  protected readonly mix = signal<GenerationMix | null>(null);
  protected readonly prices = signal<DayAheadPrices | null>(null);
  protected readonly selected = signal<string>('10Y1001A1001A47J'); // SE3 default
  protected readonly loading = signal(true);
  protected readonly reloading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly source = signal<DataSource>(this.readStoredSource());

  protected readonly sourceOptions: ReadonlyArray<{ value: DataSource; label: string; hint: string }> = [
    { value: 'auto', label: 'AUTO', hint: 'Try live, fall back to mock if upstream fails' },
    { value: 'live', label: 'LIVE', hint: 'Force live Energy-Charts call' },
    { value: 'mock', label: 'MOCK', hint: 'Force the deterministic synthetic backend' },
  ];

  protected readonly donutSlices = computed<DonutSlice[]>(() => {
    const m = this.mix();
    if (!m) return [];
    return m.slices.map((s) => ({
      key: s.kind,
      label: s.label,
      value: s.mw,
      color: fuelColor(s.kind),
      tag: s.fossilFree ? '' : 'fossil',
    }));
  });

  protected readonly priceValues = computed<number[]>(() => {
    const p = this.prices();
    if (!p) return [];
    return p.hourly.map((h) => h.price);
  });

  protected readonly currentPrice = computed<number>(() => {
    const p = this.prices();
    if (!p) return 0;
    const hour = new Date().getUTCHours();
    return p.hourly.find((h) => h.hour === hour)?.price ?? p.hourly[0]?.price ?? 0;
  });

  protected readonly minPrice = computed(() => Math.min(...(this.priceValues().length ? this.priceValues() : [0])));
  protected readonly maxPrice = computed(() => Math.max(...(this.priceValues().length ? this.priceValues() : [0])));
  protected readonly avgPrice = computed(() => {
    const v = this.priceValues();
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0;
  });

  protected readonly leadShare = computed(() => {
    const m = this.mix();
    if (!m || m.totalMw === 0 || !m.slices[0]) return 0;
    return (m.slices[0].mw / m.totalMw) * 100;
  });

  protected readonly sortedSummaries = computed(() =>
    [...this.summaries()].sort((a, b) => b.fossilFreeShare - a.fossilFreeShare),
  );

  protected readonly priceTrendLabel = computed(() => {
    const v = this.priceValues();
    if (v.length < 2) return '24h flat';
    const max = Math.max(...v);
    const min = Math.min(...v);
    if (max === 0) return '24h flat';
    return `${((max - min) / Math.max(min, 0.01) * 100).toFixed(0)}% spread today`;
  });

  protected readonly topFuelIcon = computed(() => {
    const m = this.mix();
    if (!m || !m.slices[0]) return this.WindIcon;
    const k = m.slices[0].kind;
    if (k.startsWith('fossil')) return this.FlameIcon;
    if (k.includes('wind')) return this.WindIcon;
    return this.LeafIcon;
  });

  constructor() {
    this.api.listGridZones().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => this.zones.set(res.items),
    });
    this.loadSummaries();
    this.loadZone(this.selected());
  }

  protected selectZone(code: string): void {
    if (code === this.selected()) return;
    this.selected.set(code);
    this.loadZone(code);
  }

  protected setSource(s: DataSource): void {
    if (s === this.source()) return;
    this.source.set(s);
    try { localStorage.setItem(SOURCE_STORAGE_KEY, s); } catch { /* private mode etc — non-fatal */ }
    this.reload();
  }

  protected reload(): void {
    this.reloading.set(true);
    this.loadSummaries();
    this.loadZone(this.selected(), () => this.reloading.set(false));
  }

  private loadSummaries(): void {
    this.api.getGridSummary(this.source()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => this.summaries.set(res.items),
    });
  }

  private loadZone(code: string, after?: () => void): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.getGridMix(code, this.source()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (m) => {
        this.mix.set(m);
        this.loading.set(false);
        after?.();
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? err?.message ?? 'Unknown error');
        this.loading.set(false);
        after?.();
      },
    });

    this.api.getGridPrices(code, this.source()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (p) => this.prices.set(p),
    });
  }

  private readStoredSource(): DataSource {
    try {
      const v = localStorage.getItem(SOURCE_STORAGE_KEY);
      if (v === 'auto' || v === 'live' || v === 'mock') return v;
    } catch { /* private mode etc — non-fatal */ }
    return 'auto';
  }

  protected formatMw(mw: number): string {
    if (mw >= 1000) return `${(mw / 1000).toFixed(1)} GW`;
    return `${Math.round(mw).toLocaleString('en-US')} MW`;
  }

  protected formatTime(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
  }

  protected fossilFreeMw(m: GenerationMix): string {
    const clean = m.slices.filter((s) => s.fossilFree).reduce((sum, s) => sum + s.mw, 0);
    return this.formatMw(clean);
  }

  protected sourceLabel(s: 'mock' | 'live'): string {
    return s === 'live' ? 'ENTSO-E LIVE' : 'DEMO · MOCK';
  }

  protected zoneLabel(code: string): string {
    return this.zones().find((z) => z.code === code)?.label ?? code;
  }

  protected shortZone(label: string): string {
    return label.replace(/\s—.*$/, '').replace(/\s\(.+\)$/, '');
  }

  protected flagEmoji(country: string): string {
    if (country.length !== 2) return '⬜';
    const codePoints = country.toUpperCase().split('').map((c) => 0x1f1a5 + c.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }
}
