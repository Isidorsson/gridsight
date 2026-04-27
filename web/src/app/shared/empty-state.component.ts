import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  LucideAngularModule,
  Inbox,
  CheckCircle2,
  AlertCircle,
  Hourglass,
  type LucideIconData,
} from 'lucide-angular';

const ICONS: Record<string, LucideIconData> = {
  inbox: Inbox,
  check_circle: CheckCircle2,
  error_outline: AlertCircle,
  hourglass_empty: Hourglass,
};

@Component({
  selector: 'gs-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="empty">
      <i-lucide [img]="iconData()" class="icon" [size]="40" [strokeWidth]="1.4" aria-hidden="true"></i-lucide>
      <span class="eyebrow">{{ tag() }}</span>
      <h3>{{ title() }}</h3>
      @if (description()) { <p>{{ description() }}</p> }
    </div>
  `,
  styles: [
    `
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem 1rem;
        text-align: center;
        color: var(--gs-text-muted);
        background:
          radial-gradient(120% 80% at 50% 0%, var(--gs-accent-soft), transparent 60%),
          var(--gs-surface);
        border: 1px dashed var(--gs-border-2);
        border-radius: var(--gs-radius-2);
      }
      .icon {
        color: var(--gs-accent);
        margin-bottom: 0.95rem;
        opacity: 0.85;
      }
      .eyebrow { margin-bottom: 0.6rem; }
      h3 {
        margin: 0 0 0.45rem;
        font-size: 1.05rem;
        font-weight: 500;
        letter-spacing: -0.01em;
        color: var(--gs-text);
      }
      p {
        margin: 0;
        font-size: 0.9rem;
        max-width: 42ch;
        line-height: 1.5;
      }
    `,
  ],
})
export class EmptyStateComponent {
  readonly icon = input<string>('inbox');
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);

  readonly iconData = computed<LucideIconData>(() => ICONS[this.icon()] ?? Inbox);
  readonly tag = computed(() => {
    switch (this.icon()) {
      case 'check_circle': return 'Status · Nominal';
      case 'error_outline': return 'Status · Fault';
      case 'hourglass_empty': return 'Status · Awaiting';
      default: return 'Status';
    }
  });
}
