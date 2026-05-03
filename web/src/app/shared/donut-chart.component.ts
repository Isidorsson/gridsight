import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
  /** Optional secondary tag rendered next to legend label. */
  tag?: string;
}

interface Arc {
  d: string;
  color: string;
  key: string;
  label: string;
  value: number;
  pct: number;
  tag?: string;
}

/**
 * Donut chart — single ring of arcs, value-proportional, with a center figure.
 *
 * Renders SVG without external libs. Arcs are produced via the standard
 * polar-to-cartesian + large-arc-flag trick. Falls back to a single grey ring
 * when total is 0 so the visual stays stable.
 */
@Component({
  selector: 'gs-donut-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  template: `
    <div class="donut">
      <svg [attr.viewBox]="'0 0 ' + size + ' ' + size" role="img" [attr.aria-label]="ariaLabel()">
        <circle [attr.cx]="size/2" [attr.cy]="size/2" [attr.r]="radius"
                fill="none" stroke="var(--gs-border)" [attr.stroke-width]="strokeWidth" />
        @for (a of arcs(); track a.key) {
          <path [attr.d]="a.d"
                [attr.stroke]="a.color"
                [attr.stroke-width]="strokeWidth"
                stroke-linecap="butt"
                fill="none">
            <title>{{ a.label }}: {{ a.value | number: '1.0-0' }} ({{ a.pct | number: '1.0-1' }}%)</title>
          </path>
        }
        <text class="center-value" [attr.x]="size/2" [attr.y]="size/2 - 6"
              text-anchor="middle" dominant-baseline="middle">
          {{ centerValue() }}
        </text>
        <text class="center-label" [attr.x]="size/2" [attr.y]="size/2 + 18"
              text-anchor="middle" dominant-baseline="middle">
          {{ centerLabel() }}
        </text>
      </svg>

      @if (showLegend()) {
        <ul class="legend" aria-label="Legend">
          @for (a of arcs(); track a.key) {
            <li>
              <span class="swatch" [style.background]="a.color" aria-hidden="true"></span>
              <span class="lbl">{{ a.label }}</span>
              @if (a.tag) {
                <span class="tag">{{ a.tag }}</span>
              }
              <span class="val">{{ a.value | number: '1.0-0' }}</span>
              <span class="pct">{{ a.pct | number: '1.0-1' }}%</span>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      .donut {
        display: grid;
        grid-template-columns: minmax(0, 220px) minmax(0, 1fr);
        gap: 1.6rem;
        align-items: center;
      }
      svg { width: 100%; max-width: 220px; height: auto; display: block; }
      .center-value {
        font-family: var(--gs-mono);
        font-size: 22px;
        font-weight: 500;
        fill: var(--gs-text-strong);
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.02em;
      }
      .center-label {
        font-family: var(--gs-mono);
        font-size: 9px;
        font-weight: 500;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        fill: var(--gs-text-faint);
      }
      .legend {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.18rem;
        font-family: var(--gs-mono);
        font-size: 0.74rem;
      }
      .legend li {
        display: grid;
        grid-template-columns: 10px 1fr auto auto;
        gap: 0.55rem;
        align-items: center;
        padding: 0.22rem 0;
        color: var(--gs-text-muted);
      }
      .legend .swatch {
        width: 10px; height: 10px; border-radius: 2px;
      }
      .legend .lbl { color: var(--gs-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .legend .tag {
        display: none;
      }
      .legend .val { color: var(--gs-text-strong); font-variant-numeric: tabular-nums; }
      .legend .pct {
        color: var(--gs-text-faint);
        font-variant-numeric: tabular-nums;
        min-width: 3.5em;
        text-align: right;
      }
      @media (max-width: 720px) {
        .donut { grid-template-columns: 1fr; }
        svg { margin: 0 auto; }
      }
    `,
  ],
})
export class DonutChartComponent {
  readonly slices = input.required<DonutSlice[]>();
  readonly centerValue = input<string>('');
  readonly centerLabel = input<string>('');
  readonly showLegend = input<boolean>(true);
  readonly ariaLabel = input<string>('Donut chart');

  protected readonly size = 220;
  protected readonly strokeWidth = 22;
  protected readonly radius = (this.size - this.strokeWidth) / 2;

  protected readonly arcs = computed<Arc[]>(() => {
    const items = this.slices().filter((s) => s.value > 0);
    const total = items.reduce((sum, s) => sum + s.value, 0);
    if (total === 0) return [];

    const cx = this.size / 2;
    const cy = this.size / 2;
    const r = this.radius;

    let cursor = -Math.PI / 2;
    return items.map((s) => {
      const sweep = (s.value / total) * Math.PI * 2;
      const start = cursor;
      const end = cursor + sweep;
      cursor = end;

      const x1 = cx + r * Math.cos(start);
      const y1 = cy + r * Math.sin(start);
      const x2 = cx + r * Math.cos(end);
      const y2 = cy + r * Math.sin(end);
      const large = sweep > Math.PI ? 1 : 0;

      // Use a small inset so adjacent arcs don't visually merge.
      const d =
        items.length === 1
          ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r} Z`
          : `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;

      return {
        d,
        color: s.color,
        key: s.key,
        label: s.label,
        value: s.value,
        pct: (s.value / total) * 100,
        ...(s.tag !== undefined ? { tag: s.tag } : {}),
      };
    });
  });
}
