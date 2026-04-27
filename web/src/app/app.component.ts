import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval, startWith } from 'rxjs';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SseService } from './core/sse.service';
import { DemoBannerComponent } from './shared/demo-banner.component';

@Component({
  selector: 'gs-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DemoBannerComponent],
  template: `
    <header class="app-header">
      <div class="rail-left">
        <a class="brand" routerLink="/" aria-label="GridSight home">
          <svg class="brand-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M14 3 L4 17 L14 17 L12 29 L26 13 L16 13 L18 3 Z"
                  stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/>
          </svg>
          <span class="brand-words">
            <strong>GridSight</strong>
            <span class="sub">Substation Asset Health · v0.1</span>
          </span>
        </a>
        <nav class="app-nav" aria-label="Primary">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
            <span class="hash">01</span> Fleet
          </a>
          <a routerLink="/alerts" routerLinkActive="active">
            <span class="hash">02</span> Alerts
          </a>
        </nav>
      </div>

      <div class="rail-right">
        <span class="env-pill" title="Build environment">DEMO · STOCKHOLM</span>
        <span class="clock mono" aria-label="Current time">{{ now() }}</span>
        <span class="status" [class.connected]="sse.connected()" [attr.aria-live]="'polite'">
          <span class="dot" aria-hidden="true"></span>
          <span class="status-label">{{ sse.connected() ? 'STREAM LIVE' : 'RECONNECTING' }}</span>
        </span>
      </div>
    </header>

    <div class="ticker" aria-hidden="true">
      <span>IEEE C57.91 LOADING GUIDE</span>
      <span class="sep">·</span>
      <span>IEC 60076 POWER TRANSFORMERS</span>
      <span class="sep">·</span>
      <span>IEC 61850 SUBSTATION COMMS</span>
      <span class="sep">·</span>
      <span>SCADA SIMULATED · 5s INTERVAL</span>
      <span class="sep">·</span>
      <span>RECOMMENDATIONS POWERED BY ANTHROPIC CLAUDE</span>
    </div>

    <main class="app-main">
      <gs-demo-banner />
      <router-outlet />
    </main>

    <footer class="app-foot">
      <span>GridSight · vertical-slice portfolio build</span>
      <span class="dot-sep">·</span>
      <span>Designed for distribution-grid operators</span>
      <span class="dot-sep">·</span>
      <a href="https://github.com/Isidorsson/gridsight" target="_blank" rel="noopener noreferrer">github.com/Isidorsson/gridsight</a>
    </footer>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
      }
      .app-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1.5rem;
        padding: 0.6rem 1.5rem;
        border-bottom: 1px solid var(--gs-border);
        background:
          linear-gradient(180deg, rgba(232,164,92,0.04), transparent 70%),
          color-mix(in oklab, var(--gs-bg) 92%, black);
        position: sticky;
        top: 0;
        z-index: 10;
        backdrop-filter: saturate(160%) blur(10px);
      }
      .rail-left { display: flex; align-items: center; gap: 2rem; min-width: 0; }
      .rail-right { display: flex; align-items: center; gap: 1rem; }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 0.7rem;
        color: var(--gs-text);
        text-decoration: none;
      }
      .brand:hover { text-decoration: none; }
      .brand-mark {
        width: 26px;
        height: 26px;
        color: var(--gs-accent);
        flex: none;
      }
      .brand-words { display: flex; flex-direction: column; line-height: 1.05; }
      .brand-words strong {
        font-weight: 600;
        font-size: 1.05rem;
        letter-spacing: -0.01em;
      }
      .brand-words .sub {
        font-family: var(--gs-mono);
        font-size: 0.66rem;
        letter-spacing: 0.10em;
        text-transform: uppercase;
        color: var(--gs-text-faint);
        margin-top: 2px;
      }

      .app-nav {
        display: flex;
        gap: 0.15rem;
        padding-left: 1.5rem;
        border-left: 1px solid var(--gs-border);
      }
      .app-nav a {
        display: inline-flex;
        align-items: baseline;
        gap: 0.5rem;
        padding: 0.42rem 0.8rem;
        border-radius: var(--gs-radius);
        color: var(--gs-text-muted);
        font-weight: 500;
        font-size: 0.88rem;
        font-family: var(--gs-sans);
        transition: background 0.15s, color 0.15s;
      }
      .app-nav a:hover {
        background: var(--gs-surface-2);
        color: var(--gs-text);
        text-decoration: none;
      }
      .app-nav a.active {
        background: var(--gs-accent-soft);
        color: var(--gs-accent-bright);
        box-shadow: inset 0 0 0 1px var(--gs-accent-line);
      }
      .app-nav .hash {
        font-family: var(--gs-mono);
        font-size: 0.7rem;
        letter-spacing: 0.05em;
        color: var(--gs-text-faint);
      }
      .app-nav a.active .hash { color: var(--gs-accent); }

      .env-pill {
        font-family: var(--gs-mono);
        font-size: 0.66rem;
        letter-spacing: 0.16em;
        font-weight: 600;
        color: var(--gs-accent);
        padding: 0.28rem 0.55rem;
        border: 1px solid var(--gs-accent-line);
        border-radius: 4px;
        background: var(--gs-accent-soft);
      }
      .clock {
        font-size: 0.78rem;
        color: var(--gs-text-muted);
        letter-spacing: 0.04em;
        font-variant-numeric: tabular-nums;
      }

      .status {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        font-family: var(--gs-mono);
        font-size: 0.66rem;
        letter-spacing: 0.14em;
        color: var(--gs-text-muted);
        padding: 0.28rem 0.55rem;
        border: 1px solid var(--gs-border-2);
        border-radius: 4px;
      }
      .status .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--gs-text-faint);
      }
      .status.connected {
        border-color: rgba(74, 222, 128, 0.35);
        color: var(--gs-low);
      }
      .status.connected .dot {
        background: var(--gs-low);
        box-shadow: 0 0 0 4px rgba(74, 222, 128, 0.18);
        animation: gs-pulse 2.6s ease-in-out infinite;
      }

      .ticker {
        display: flex;
        gap: 0.85rem;
        align-items: center;
        flex-wrap: wrap;
        padding: 0.5rem 1.5rem;
        font-family: var(--gs-mono);
        font-size: 0.66rem;
        letter-spacing: 0.14em;
        color: var(--gs-text-faint);
        border-bottom: 1px solid var(--gs-border);
        background: var(--gs-bg-2);
      }
      .ticker .sep { color: var(--gs-accent); opacity: 0.6; }

      .app-main {
        max-width: 1320px;
        margin: 0 auto;
        padding: 2rem 1.5rem 3rem;
        animation: gs-fade-in 0.35s ease-out both;
      }

      .app-foot {
        max-width: 1320px;
        margin: 0 auto;
        padding: 1.25rem 1.5rem 2.5rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
        align-items: center;
        font-family: var(--gs-mono);
        font-size: 0.7rem;
        letter-spacing: 0.06em;
        color: var(--gs-text-faint);
        border-top: 1px solid var(--gs-border);
      }
      .app-foot a { color: var(--gs-text-muted); }
      .app-foot a:hover { color: var(--gs-accent); }
      .dot-sep { color: var(--gs-accent); opacity: 0.5; }

      @media (max-width: 860px) {
        .app-header { flex-wrap: wrap; gap: 0.75rem; padding: 0.6rem 1rem; }
        .rail-left { gap: 1rem; }
        .app-nav { padding-left: 1rem; }
        .brand-words .sub { display: none; }
        .ticker { display: none; }
        .env-pill { display: none; }
      }
      @media (max-width: 520px) {
        .clock { display: none; }
        .app-main { padding: 1.25rem 1rem 2rem; }
      }
    `,
  ],
})
export class AppComponent {
  protected readonly sse = inject(SseService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly now = signal(this.formatNow());

  constructor() {
    interval(1000)
      .pipe(startWith(0), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.now.set(this.formatNow()));
  }

  private formatNow(): string {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss} CET`;
  }
}
