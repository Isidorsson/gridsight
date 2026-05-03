import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Tiny inline sparkline. Pure SVG, no axes, optional warn/alarm bands.
 *
 * Renders an area + line over the supplied numeric series. Stretches to fill
 * its container width via a viewBox + preserveAspectRatio="none". The trailing
 * point gets an emphasised dot so the latest value is locatable at a glance.
 */
@Component({
  selector: 'gs-sparkline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" [attr.aria-label]="ariaLabel()">
      @if (alarmY() !== null) {
        <line x1="0" x2="100" [attr.y1]="alarmY()" [attr.y2]="alarmY()"
              stroke="var(--gs-high)" stroke-width="0.4" stroke-dasharray="2 2" opacity="0.55"/>
      }
      @if (warnY() !== null) {
        <line x1="0" x2="100" [attr.y1]="warnY()" [attr.y2]="warnY()"
              stroke="var(--gs-medium)" stroke-width="0.4" stroke-dasharray="2 2" opacity="0.45"/>
      }
      @if (areaPath()) {
        <path [attr.d]="areaPath()" [attr.fill]="color()" opacity="0.12"/>
      }
      @if (linePath()) {
        <path [attr.d]="linePath()" fill="none" [attr.stroke]="color()" stroke-width="1" stroke-linejoin="round"/>
      }
      @if (lastPoint(); as p) {
        <circle [attr.cx]="p.x" [attr.cy]="p.y" r="1.4" [attr.fill]="color()"/>
      }
    </svg>
  `,
  styles: [
    `
      :host { display: block; width: 100%; }
      svg { width: 100%; height: 100%; display: block; }
    `,
  ],
})
export class SparklineComponent {
  readonly values = input.required<number[]>();
  readonly color = input<string>('var(--gs-cool)');
  readonly warn = input<number | null>(null);
  readonly alarm = input<number | null>(null);
  readonly ariaLabel = input<string>('Sparkline');

  private readonly width = 100;
  private readonly height = 30;
  private readonly pad = 1.5;

  private readonly bounds = computed(() => {
    const v = this.values();
    const fixed: number[] = [];
    if (this.warn() !== null) fixed.push(this.warn()!);
    if (this.alarm() !== null) fixed.push(this.alarm()!);
    const all = v.length ? v : [0, 1];
    const min = Math.min(...all, ...fixed);
    const max = Math.max(...all, ...fixed);
    const span = Math.max(max - min, 1e-6);
    return { min: min - span * 0.1, max: max + span * 0.1 };
  });

  private yFor(v: number): number {
    const { min, max } = this.bounds();
    const range = max - min || 1;
    return this.pad + (1 - (v - min) / range) * (this.height - 2 * this.pad);
  }

  private xFor(i: number, n: number): number {
    if (n <= 1) return this.pad;
    return this.pad + (i / (n - 1)) * (this.width - 2 * this.pad);
  }

  protected readonly warnY = computed(() => this.warn() === null ? null : this.yFor(this.warn()!));
  protected readonly alarmY = computed(() => this.alarm() === null ? null : this.yFor(this.alarm()!));

  protected readonly linePath = computed(() => {
    const v = this.values();
    if (v.length < 2) return '';
    return v
      .map((val, i) => `${i === 0 ? 'M' : 'L'} ${this.xFor(i, v.length).toFixed(2)} ${this.yFor(val).toFixed(2)}`)
      .join(' ');
  });

  protected readonly areaPath = computed(() => {
    const v = this.values();
    if (v.length < 2) return '';
    const top = v
      .map((val, i) => `${i === 0 ? 'M' : 'L'} ${this.xFor(i, v.length).toFixed(2)} ${this.yFor(val).toFixed(2)}`)
      .join(' ');
    const lastX = this.xFor(v.length - 1, v.length).toFixed(2);
    const firstX = this.xFor(0, v.length).toFixed(2);
    const bottomY = (this.height - this.pad).toFixed(2);
    return `${top} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  });

  protected readonly lastPoint = computed<{ x: number; y: number } | null>(() => {
    const v = this.values();
    if (v.length === 0) return null;
    return { x: this.xFor(v.length - 1, v.length), y: this.yFor(v[v.length - 1]!) };
  });
}
