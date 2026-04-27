import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { TelemetryReading } from '../../core/types';

interface Series {
  label: string;
  unit: string;
  color: string;
  values: number[];
  warn?: number;
  alarm?: number;
}

@Component({
  selector: 'gs-telemetry-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  template: `
    @let s = series();
    @let v = latest();
    @let alarmY = s.alarm !== undefined ? yFor(s.alarm) : null;
    @let warnY = s.warn !== undefined ? yFor(s.warn) : null;
    @let p = path();
    <figure class="chart" role="img" [attr.aria-label]="ariaLabel()">
      <figcaption>
        <span class="title">{{ s.label }}</span>
        @if (v !== null) {
          <span class="value">{{ v | number: '1.0-2' }} {{ s.unit }}</span>
        }
      </figcaption>
      <svg viewBox="0 0 600 140" preserveAspectRatio="none">
        @if (alarmY !== null) {
          <line [attr.x1]="0" [attr.x2]="600"
                [attr.y1]="alarmY" [attr.y2]="alarmY"
                stroke="var(--gs-high)" stroke-width="1" stroke-dasharray="4 4" opacity="0.7" />
        }
        @if (warnY !== null) {
          <line [attr.x1]="0" [attr.x2]="600"
                [attr.y1]="warnY" [attr.y2]="warnY"
                stroke="var(--gs-medium)" stroke-width="1" stroke-dasharray="4 4" opacity="0.5" />
        }
        @if (p) {
          <path [attr.d]="p" fill="none" [attr.stroke]="s.color" stroke-width="1.6" stroke-linejoin="round" />
          <path [attr.d]="areaPath()" [attr.fill]="s.color" opacity="0.08" />
        }
      </svg>
    </figure>
  `,
  styles: [
    `
      .chart {
        margin: 0;
        padding: 0.85rem 1rem;
        background: var(--gs-surface);
        border: 1px solid var(--gs-border);
        border-radius: 10px;
      }
      figcaption {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 0.4rem;
      }
      .title {
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--gs-text-muted);
      }
      .value {
        font-family: var(--gs-mono);
        font-size: 0.95rem;
      }
      svg {
        width: 100%;
        height: 90px;
        display: block;
      }
    `,
  ],
})
export class TelemetryChartComponent {
  readonly readings = input.required<TelemetryReading[]>();
  readonly metric = input.required<keyof TelemetryReading>();
  readonly series = input.required<Omit<Series, 'values'>>();

  private readonly width = 600;
  private readonly height = 140;
  private readonly pad = 8;

  private readonly numericValues = computed(() => {
    const all = this.readings();
    return all.map((r) => Number(r[this.metric()]));
  });

  protected readonly latest = computed<number | null>(() => {
    const v = this.numericValues();
    return v.length ? (v[v.length - 1] ?? null) : null;
  });

  private readonly bounds = computed(() => {
    const values = this.numericValues();
    const fixed: number[] = [];
    if (this.series().warn !== undefined) fixed.push(this.series().warn!);
    if (this.series().alarm !== undefined) fixed.push(this.series().alarm!);
    const all = values.length ? values : [0, 1];
    const min = Math.min(...all, ...fixed);
    const max = Math.max(...all, ...fixed);
    const span = Math.max(max - min, 1);
    return { min: min - span * 0.08, max: max + span * 0.08 };
  });

  protected yFor(v: number): number {
    const { min, max } = this.bounds();
    const range = max - min || 1;
    return this.pad + (1 - (v - min) / range) * (this.height - 2 * this.pad);
  }

  private xFor(i: number, n: number): number {
    if (n <= 1) return this.pad;
    return this.pad + (i / (n - 1)) * (this.width - 2 * this.pad);
  }

  protected readonly path = computed(() => {
    const v = this.numericValues();
    if (v.length < 2) return '';
    return v
      .map((val, i) => `${i === 0 ? 'M' : 'L'} ${this.xFor(i, v.length).toFixed(1)} ${this.yFor(val).toFixed(1)}`)
      .join(' ');
  });

  protected readonly areaPath = computed(() => {
    const v = this.numericValues();
    if (v.length < 2) return '';
    const top = v
      .map((val, i) => `${i === 0 ? 'M' : 'L'} ${this.xFor(i, v.length).toFixed(1)} ${this.yFor(val).toFixed(1)}`)
      .join(' ');
    const lastX = this.xFor(v.length - 1, v.length).toFixed(1);
    const firstX = this.xFor(0, v.length).toFixed(1);
    const bottomY = (this.height - this.pad).toFixed(1);
    return `${top} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  });

  protected readonly ariaLabel = computed(() => {
    const v = this.latest();
    return v !== null
      ? `${this.series().label} sparkline. Latest value ${v.toFixed(2)} ${this.series().unit}.`
      : `${this.series().label} sparkline. No data.`;
  });
}
