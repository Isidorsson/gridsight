import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideAngularModule, FlaskConical, Github, ArrowUpRight } from 'lucide-angular';
import { LanguageService } from '../core/i18n/language.service';

@Component({
  selector: 'gs-demo-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <aside class="banner" role="note" aria-label="Demo mode notice">
      <div class="badge" aria-hidden="true">
        <i-lucide [img]="FlaskIcon" [size]="16" [strokeWidth]="1.8"></i-lucide>
        <span>{{ i18n.t('banner.tag') }}</span>
      </div>
      <div class="text">
        <p [innerHTML]="i18n.t('banner.body.html')"></p>
        <p class="sub" [innerHTML]="i18n.t('banner.body.sub.html')"></p>
      </div>
      <a class="repo-link"
         href="https://github.com/Isidorsson/gridsight"
         target="_blank"
         rel="noopener noreferrer"
         aria-label="View source on GitHub">
        <i-lucide [img]="GithubIcon" [size]="14" [strokeWidth]="1.8" aria-hidden="true"></i-lucide>
        <span>{{ i18n.t('banner.source') }}</span>
        <i-lucide [img]="ArrowIcon" [size]="12" [strokeWidth]="2" aria-hidden="true"></i-lucide>
      </a>
    </aside>
  `,
  styles: [
    `
      .banner {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 1.25rem;
        padding: 0.85rem 1.1rem;
        background:
          linear-gradient(90deg, var(--gs-accent-soft), transparent 50%),
          var(--gs-surface);
        border: 1px solid var(--gs-border);
        border-left: 3px solid var(--gs-accent);
        color: var(--gs-text);
        border-radius: var(--gs-radius);
        font-size: 0.86rem;
        line-height: 1.5;
        margin-bottom: 1.75rem;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.32rem 0.55rem;
        font-family: var(--gs-mono);
        font-size: 0.66rem;
        font-weight: 600;
        letter-spacing: 0.16em;
        color: var(--gs-accent);
        background: var(--gs-accent-soft);
        border: 1px solid var(--gs-accent-line);
        border-radius: var(--gs-radius-3);
        white-space: nowrap;
      }
      .text { min-width: 0; }
      .text p { margin: 0; }
      .text p.sub {
        margin-top: 0.25rem;
        font-size: 0.78rem;
        color: var(--gs-text-muted);
      }
      .text strong { color: var(--gs-text-strong); font-weight: 600; }
      .text code {
        font-family: var(--gs-mono);
        font-size: 0.78rem;
        padding: 0.05rem 0.4rem;
        background: var(--gs-bg-2);
        border: 1px solid var(--gs-border);
        border-radius: var(--gs-radius-3);
      }
      .repo-link {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        flex-shrink: 0;
        padding: 0.45rem 0.7rem;
        font-family: var(--gs-mono);
        font-size: 0.7rem;
        font-weight: 500;
        letter-spacing: 0.12em;
        color: var(--gs-text);
        background: var(--gs-bg-2);
        border: 1px solid var(--gs-border-2);
        border-radius: var(--gs-radius-3);
        text-decoration: none;
        transition: border-color 0.15s, color 0.15s, background 0.15s;
      }
      .repo-link:hover {
        border-color: var(--gs-accent-line);
        color: var(--gs-accent);
        background: var(--gs-accent-soft);
        text-decoration: none;
      }
      @media (max-width: 720px) {
        .banner { grid-template-columns: 1fr; gap: 0.75rem; }
        .repo-link { justify-self: start; }
      }
    `,
  ],
})
export class DemoBannerComponent {
  protected readonly i18n = inject(LanguageService);
  protected readonly FlaskIcon = FlaskConical;
  protected readonly GithubIcon = Github;
  protected readonly ArrowIcon = ArrowUpRight;
}
