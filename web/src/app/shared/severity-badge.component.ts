import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Severity } from '../core/types';

@Component({
  selector: 'gs-severity-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="severity()" [attr.aria-label]="'Severity: ' + severity()">{{ severity() }}</span>`,
  styles: [
    `
      .badge {
        display: inline-block;
        padding: 0.18rem 0.55rem;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        line-height: 1.4;
      }
      .low      { background: rgba(22, 163, 74, 0.15); color: var(--gs-low); }
      .medium   { background: rgba(217, 119, 6, 0.15); color: var(--gs-medium); }
      .high     { background: rgba(220, 38, 38, 0.15); color: var(--gs-high); }
      .critical { background: var(--gs-critical); color: white; }
    `,
  ],
})
export class SeverityBadgeComponent {
  readonly severity = input.required<Severity>();
}
