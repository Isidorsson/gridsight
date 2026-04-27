import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'gs-demo-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <aside class="banner" role="note" aria-label="Demo mode notice">
      <mat-icon aria-hidden="true">info</mat-icon>
      <div class="text">
        <strong>Portfolio demo.</strong>
        Telemetry is simulated; AI maintenance recommendations are
        <strong>hand-authored fixtures</strong>, not live Claude calls — the deployed
        demo intentionally ships without an Anthropic API key. The real
        Anthropic integration (with tool-use schema enforcement) lives in
        <code>api/src/domain/recommender.ts</code> and runs locally when
        <code>ANTHROPIC_API_KEY</code> is set.
      </div>
      <a class="repo-link"
         href="https://github.com/Isidorsson/gridsight"
         target="_blank"
         rel="noopener noreferrer"
         aria-label="View source on GitHub">
        <mat-icon aria-hidden="true">open_in_new</mat-icon>
        <span>Source</span>
      </a>
    </aside>
  `,
  styles: [
    `
      .banner {
        display: flex;
        align-items: flex-start;
        gap: 0.85rem;
        padding: 0.7rem 1rem;
        background: rgba(25, 118, 210, 0.08);
        border: 1px solid rgba(25, 118, 210, 0.25);
        color: var(--gs-text);
        border-radius: 10px;
        font-size: 0.85rem;
        line-height: 1.5;
        margin-bottom: 1.25rem;
      }
      mat-icon {
        flex-shrink: 0;
        color: var(--gs-accent);
        font-size: 1.2rem;
        width: 1.2rem;
        height: 1.2rem;
        margin-top: 0.1rem;
      }
      .text { flex: 1; min-width: 0; }
      .text strong { color: var(--gs-text); }
      .text code {
        font-family: var(--gs-mono);
        font-size: 0.78rem;
        padding: 0.05rem 0.35rem;
        background: var(--gs-surface-2);
        border-radius: 4px;
      }
      .repo-link {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        flex-shrink: 0;
        padding: 0.35rem 0.65rem;
        font-size: 0.78rem;
        font-weight: 500;
        color: var(--gs-accent);
        background: var(--gs-surface);
        border: 1px solid var(--gs-border);
        border-radius: 6px;
        text-decoration: none;
        transition: border-color 0.15s, color 0.15s;
      }
      .repo-link:hover {
        border-color: var(--gs-accent);
        text-decoration: none;
      }
      .repo-link mat-icon {
        font-size: 0.95rem;
        width: 0.95rem;
        height: 0.95rem;
        margin: 0;
      }
      @media (max-width: 720px) {
        .banner { flex-wrap: wrap; }
        .repo-link { margin-left: auto; }
      }
    `,
  ],
})
export class DemoBannerComponent {}
