import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { SseService } from './core/sse.service';

@Component({
  selector: 'gs-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, MatButtonModule],
  template: `
    <header class="app-header">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">⚡</span>
        <strong>GridSight</strong>
        <span class="brand-tag">substation asset health</span>
      </div>
      <nav class="app-nav" aria-label="Primary">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Dashboard</a>
        <a routerLink="/alerts" routerLinkActive="active">Alerts</a>
      </nav>
      <div class="status" [class.connected]="sse.connected()" [attr.aria-live]="'polite'">
        <span class="dot" aria-hidden="true"></span>
        {{ sse.connected() ? 'Live' : 'Reconnecting…' }}
      </div>
    </header>

    <main class="app-main">
      <router-outlet />
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
      }
      .app-header {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        padding: 0.85rem 1.5rem;
        border-bottom: 1px solid var(--gs-border);
        background: var(--gs-surface);
        position: sticky;
        top: 0;
        z-index: 10;
        backdrop-filter: saturate(180%) blur(8px);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        font-size: 1.05rem;
      }
      .brand-mark {
        color: var(--gs-accent);
        font-size: 1.4rem;
      }
      .brand-tag {
        color: var(--gs-text-muted);
        font-size: 0.85rem;
        font-weight: 400;
      }
      .app-nav {
        display: flex;
        gap: 0.25rem;
        margin-left: 2rem;
      }
      .app-nav a {
        padding: 0.45rem 0.9rem;
        border-radius: 8px;
        color: var(--gs-text-muted);
        font-weight: 500;
        font-size: 0.92rem;
        transition: background 0.15s, color 0.15s;
      }
      .app-nav a:hover {
        background: var(--gs-surface-2);
        color: var(--gs-text);
        text-decoration: none;
      }
      .app-nav a.active {
        background: var(--gs-accent-soft);
        color: var(--gs-accent);
      }
      .status {
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
        color: var(--gs-text-muted);
      }
      .status .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--gs-text-muted);
      }
      .status.connected .dot {
        background: var(--gs-low);
        box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.18);
      }
      .app-main {
        max-width: 1280px;
        margin: 0 auto;
        padding: 1.5rem;
      }
      @media (max-width: 600px) {
        .app-header { gap: 0.75rem; padding: 0.6rem 1rem; }
        .brand-tag { display: none; }
        .app-nav { margin-left: 0.5rem; }
      }
    `,
  ],
})
export class AppComponent {
  protected readonly sse = inject(SseService);
}
