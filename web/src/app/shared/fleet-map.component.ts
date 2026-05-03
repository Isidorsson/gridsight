import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { Alert, Asset, Severity } from '../core/types';

interface Pin {
  asset: Asset;
  cx: number;
  cy: number;
  severity: Severity | null;
  label: string;
}

/**
 * Stylised SVG plot of the asset fleet over a Solna/Stockholm-metro bounding box.
 *
 * Coordinates project lat/lng linearly into a 480x320 SVG canvas. The bounds are
 * picked to comfortably contain every seed asset; assets without coordinates are
 * skipped silently. Severity colors mirror the rest of the UI.
 *
 * Light decoration (river/parkline guidelines, scale bar) gives spatial context
 * without needing real basemap tiles.
 */
@Component({
  selector: 'gs-fleet-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="map">
      <header>
        <span class="eyebrow">Fleet · Solna metro</span>
        <span class="hint mono">{{ pins().length }} assets · synthetic basemap</span>
      </header>
      <svg viewBox="0 0 480 320" role="img" aria-label="Fleet map of Solna metro substation assets">
        <defs>
          <pattern id="gs-map-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--gs-grid-line)" stroke-width="0.5"/>
          </pattern>
          <linearGradient id="gs-map-water" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="var(--gs-cool)" stop-opacity="0.10"/>
            <stop offset="100%" stop-color="var(--gs-cool)" stop-opacity="0.03"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="480" height="320" fill="url(#gs-map-grid)"/>

        <!-- Brunnsviken / Lake — abstract water blob, purely decorative -->
        <path d="M 120 180 Q 165 160 210 180 T 305 180 Q 320 200 295 220 Q 240 235 165 220 Q 110 205 120 180 Z"
              fill="url(#gs-map-water)" stroke="var(--gs-cool)" stroke-opacity="0.18" stroke-width="0.7"/>

        <!-- Highway hint -->
        <path d="M 30 90 Q 180 80 320 95 T 460 110" fill="none"
              stroke="var(--gs-border-2)" stroke-width="1" stroke-dasharray="3 4" opacity="0.55"/>
        <path d="M 60 280 Q 200 250 340 270 T 460 245" fill="none"
              stroke="var(--gs-border-2)" stroke-width="1" stroke-dasharray="3 4" opacity="0.4"/>

        <!-- Crosshairs at city center -->
        <g opacity="0.35">
          <line x1="240" y1="0" x2="240" y2="320" stroke="var(--gs-border-2)" stroke-width="0.4"/>
          <line x1="0" y1="160" x2="480" y2="160" stroke="var(--gs-border-2)" stroke-width="0.4"/>
        </g>

        <!-- Pins -->
        @for (p of pins(); track p.asset.id) {
          <g class="pin" [attr.data-severity]="p.severity ?? 'ok'"
             (click)="select.emit(p.asset)" (mouseenter)="hovered.set(p.asset.id)" (mouseleave)="hovered.set(null)">
            <circle [attr.cx]="p.cx" [attr.cy]="p.cy" r="11" class="halo"/>
            <circle [attr.cx]="p.cx" [attr.cy]="p.cy" r="4.5" class="dot"/>
            <text [attr.x]="p.cx + 9" [attr.y]="p.cy + 3" class="lbl"
                  [class.show]="hovered() === p.asset.id || p.severity">
              {{ p.label }}
            </text>
          </g>
        }

        <!-- Scale bar -->
        <g transform="translate(20, 295)" opacity="0.65">
          <line x1="0" x2="60" y1="0" y2="0" stroke="var(--gs-text-faint)" stroke-width="0.8"/>
          <line x1="0" x2="0" y1="-3" y2="3" stroke="var(--gs-text-faint)" stroke-width="0.8"/>
          <line x1="60" x2="60" y1="-3" y2="3" stroke="var(--gs-text-faint)" stroke-width="0.8"/>
          <text x="30" y="14" text-anchor="middle" class="scale">~ 2 km</text>
        </g>

        <!-- N indicator -->
        <g transform="translate(450, 30)" opacity="0.7">
          <text x="0" y="0" text-anchor="middle" class="north">N</text>
          <line x1="0" y1="2" x2="0" y2="14" stroke="var(--gs-accent)" stroke-width="1"/>
          <polygon points="0,-8 -3,2 3,2" fill="var(--gs-accent)"/>
        </g>
      </svg>
      <figcaption class="legend">
        <span class="dot ok"></span>nominal
        <span class="dot low"></span>low
        <span class="dot medium"></span>medium
        <span class="dot high"></span>high
        <span class="dot critical"></span>critical
      </figcaption>
    </figure>
  `,
  styles: [
    `
      .map {
        margin: 0;
        background: var(--gs-bg-2);
        border: 1px solid var(--gs-border);
        border-radius: var(--gs-radius-2);
        overflow: hidden;
      }
      header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding: 0.85rem 1rem 0.5rem;
        gap: 0.85rem;
        flex-wrap: wrap;
      }
      .hint {
        font-family: var(--gs-mono);
        font-size: 0.66rem;
        letter-spacing: 0.12em;
        color: var(--gs-text-faint);
      }
      svg { width: 100%; display: block; height: auto; }
      .pin .dot {
        fill: var(--gs-low);
        stroke: var(--gs-bg);
        stroke-width: 1.2;
        cursor: pointer;
        transition: r 0.15s;
      }
      .pin .halo {
        fill: var(--gs-low);
        opacity: 0.18;
        cursor: pointer;
      }
      .pin[data-severity='medium'] .dot,
      .pin[data-severity='medium'] .halo { fill: var(--gs-medium); }
      .pin[data-severity='high'] .dot,
      .pin[data-severity='high'] .halo { fill: var(--gs-high); }
      .pin[data-severity='critical'] .dot,
      .pin[data-severity='critical'] .halo {
        fill: var(--gs-critical);
        animation: gs-pulse 2s ease-in-out infinite;
      }
      .pin:hover .dot { r: 6; }
      .pin .lbl {
        font-family: var(--gs-mono);
        font-size: 8.5px;
        fill: var(--gs-text-muted);
        opacity: 0;
        transition: opacity 0.15s;
        pointer-events: none;
      }
      .pin .lbl.show, .pin:hover .lbl { opacity: 1; fill: var(--gs-text); }
      .scale, .north {
        font-family: var(--gs-mono);
        font-size: 8.5px;
        fill: var(--gs-text-muted);
        letter-spacing: 0.16em;
      }
      .legend {
        display: flex;
        gap: 0.85rem;
        padding: 0.55rem 1rem 0.85rem;
        font-family: var(--gs-mono);
        font-size: 0.66rem;
        letter-spacing: 0.12em;
        color: var(--gs-text-faint);
        text-transform: uppercase;
        border-top: 1px solid var(--gs-border);
      }
      .legend .dot {
        display: inline-block;
        width: 8px; height: 8px;
        border-radius: 50%;
        margin-right: 0.3rem;
        vertical-align: middle;
      }
      .legend .dot.ok       { background: var(--gs-low); }
      .legend .dot.low      { background: var(--gs-low); }
      .legend .dot.medium   { background: var(--gs-medium); }
      .legend .dot.high     { background: var(--gs-high); }
      .legend .dot.critical { background: var(--gs-critical); }
    `,
  ],
})
export class FleetMapComponent {
  readonly assets = input.required<Asset[]>();
  readonly alertsByAsset = input<Map<string, Alert[]>>(new Map());

  readonly select = output<Asset>();

  protected readonly hovered = signal<string | null>(null);

  // bounding box covering all seed asset coordinates with margin
  private readonly minLng = 17.92;
  private readonly maxLng = 18.04;
  private readonly minLat = 59.34;
  private readonly maxLat = 59.41;

  protected readonly pins = computed<Pin[]>(() => {
    const ranks = { critical: 4, high: 3, medium: 2, low: 1 } as const;
    const map = this.alertsByAsset();
    return this.assets()
      .filter((a) => a.locationLat !== undefined && a.locationLng !== undefined)
      .map((a) => {
        const cx = ((a.locationLng! - this.minLng) / (this.maxLng - this.minLng)) * 480;
        // y inverted so north is up
        const cy = (1 - (a.locationLat! - this.minLat) / (this.maxLat - this.minLat)) * 320;
        const open = (map.get(a.id) ?? []).filter((al) => al.status === 'open');
        let severity: Severity | null = null;
        for (const al of open) {
          if (!severity || ranks[al.severity] > ranks[severity]) severity = al.severity;
        }
        return { asset: a, cx, cy, severity, label: a.name };
      });
  });
}
