import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'gs-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="empty">
      <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
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
        padding: 3rem 1rem;
        text-align: center;
        color: var(--gs-text-muted);
      }
      mat-icon {
        font-size: 2.5rem;
        width: 2.5rem;
        height: 2.5rem;
        margin-bottom: 0.75rem;
        opacity: 0.6;
      }
      h3 {
        margin: 0 0 0.4rem;
        font-size: 1rem;
        color: var(--gs-text);
      }
      p {
        margin: 0;
        font-size: 0.88rem;
        max-width: 36ch;
      }
    `,
  ],
})
export class EmptyStateComponent {
  readonly icon = input<string>('inbox');
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
}
