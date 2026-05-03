import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  LucideAngularModule,
  Activity,
  ArrowRight,
  Cpu,
  Database,
  Globe2,
  Leaf,
  Radar,
  Server,
  Sparkles,
  Triangle,
  Wifi,
  Zap,
} from 'lucide-angular';
import { ApiService } from '../../core/api.service';
import { SseService } from '../../core/sse.service';
import { LanguageService } from '../../core/i18n/language.service';
import { SparklineComponent } from '../../shared/sparkline.component';
import type { Alert, Asset, ZoneSummary } from '../../core/types';

@Component({
  selector: 'gs-showcase',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, LucideAngularModule, SparklineComponent],
  template: `
    <section class="hero">
      <div class="hero-grid" aria-hidden="true"></div>
      <div class="hero-content">
        <span class="eyebrow">{{ i18n.t('show.eyebrow') }}</span>
        <h1>
          {{ i18n.t('show.headline.prefix') }} <span class="hl">{{ i18n.t('show.headline.highlight') }}</span>{{ i18n.t('show.headline.suffix') }}
        </h1>
        <p class="lede">{{ i18n.t('show.lede') }}</p>
        <div class="cta-row">
          <a class="cta primary" routerLink="/fleet">
            <span class="cta-num">01</span>
            <span class="cta-body">
              <strong>{{ i18n.t('show.cta.fleet.title') }}</strong>
              <span class="sub">{{ i18n.t('show.cta.fleet.sub') }}</span>
            </span>
            <i-lucide [img]="ArrowRightIcon" [size]="14" [strokeWidth]="2"></i-lucide>
          </a>
          <a class="cta" routerLink="/grid">
            <span class="cta-num">02</span>
            <span class="cta-body">
              <strong>{{ i18n.t('show.cta.grid.title') }}</strong>
              <span class="sub">{{ i18n.t('show.cta.grid.sub') }}</span>
            </span>
            <i-lucide [img]="ArrowRightIcon" [size]="14" [strokeWidth]="2"></i-lucide>
          </a>
        </div>

        <div class="hero-meta mono">
          <span class="m">
            <span class="dot" [class.live]="sse.connected()"></span>
            {{ sse.connected() ? i18n.t('show.meta.streamLive') : i18n.t('show.meta.streamReconnect') }}
          </span>
          <span class="sep">·</span>
          <span>{{ readingsTotal() | number: '1.0-0' }} {{ i18n.t('show.meta.readings') }}</span>
          <span class="sep">·</span>
          <span>{{ openAlertCount() }} {{ i18n.t('show.meta.openAlerts') }}</span>
          <span class="sep">·</span>
          <span>{{ i18n.t('show.meta.builtIn') }}</span>
        </div>
      </div>
    </section>

    <section class="live-board" aria-label="Live system tiles">
      <article class="tile fleet">
        <header>
          <span class="eyebrow">
            <i-lucide [img]="RadarIcon" [size]="11" [strokeWidth]="2"></i-lucide>
            {{ i18n.t('show.tile.fleet') }}
          </span>
          <a class="more" routerLink="/fleet">
            {{ i18n.t('show.tile.view') }} <i-lucide [img]="ArrowRightIcon" [size]="11" [strokeWidth]="2"></i-lucide>
          </a>
        </header>
        <div class="tile-body">
          <div class="big">
            <span class="num">{{ assetCount() | number: '2.0-0' }}</span>
            <span class="lbl">{{ i18n.t('show.tile.fleet.assets') }}</span>
          </div>
          <ul class="severity-list">
            <li><span class="dot critical"></span><strong>{{ severityCounts().critical | number: '2.0-0' }}</strong> {{ i18n.t('dashboard.sev.critical') }}</li>
            <li><span class="dot high"></span><strong>{{ severityCounts().high | number: '2.0-0' }}</strong> {{ i18n.t('dashboard.sev.high') }}</li>
            <li><span class="dot medium"></span><strong>{{ severityCounts().medium | number: '2.0-0' }}</strong> {{ i18n.t('dashboard.sev.medium') }}</li>
            <li><span class="dot low"></span><strong>{{ severityCounts().low | number: '2.0-0' }}</strong> {{ i18n.t('dashboard.sev.low') }}</li>
          </ul>
        </div>
        <footer>
          <gs-sparkline [values]="readingsRate()" color="var(--gs-accent)" ariaLabel="Telemetry rate sparkline" />
          <span class="footnote mono">{{ i18n.t('show.tile.fleet.foot') }}</span>
        </footer>
      </article>

      <article class="tile grid">
        <header>
          <span class="eyebrow">
            <i-lucide [img]="GlobeIcon" [size]="11" [strokeWidth]="2"></i-lucide>
            {{ i18n.t('show.tile.grid') }}
          </span>
          <a class="more" routerLink="/grid">
            {{ i18n.t('show.tile.view') }} <i-lucide [img]="ArrowRightIcon" [size]="11" [strokeWidth]="2"></i-lucide>
          </a>
        </header>
        <div class="tile-body">
          @if (greenestZone(); as g) {
            <div class="big">
              <span class="num">{{ g.fossilFreeShare * 100 | number: '1.1-1' }}<em>%</em></span>
              <span class="lbl">{{ i18n.t('show.tile.grid.cleanest') }} {{ flagEmoji(g.country) }} {{ shortZone(g.label) }}</span>
            </div>
          }
          @if (dirtiestZone(); as d) {
            <ul class="vs-list">
              <li>
                <span class="vs-lab">{{ i18n.t('show.tile.grid.vs') }}</span>
                <strong>{{ d.fossilFreeShare * 100 | number: '1.0-1' }}%</strong>
                <span class="vs-zone">{{ flagEmoji(d.country) }} {{ shortZone(d.label) }}</span>
              </li>
              <li>
                <span class="vs-lab">{{ i18n.t('show.tile.grid.spread') }}</span>
                <strong>{{ priceSpread() | number: '1.0-0' }} €/MWh</strong>
                <span class="vs-zone">{{ i18n.t('show.tile.grid.zonesAcross') }} {{ summaries().length }} {{ i18n.t('show.tile.grid.zonesSuffix') }}</span>
              </li>
            </ul>
          }
        </div>
        <footer>
          <div class="zone-strip" aria-hidden="true">
            @for (z of sortedSummaries(); track z.zone) {
              <span class="zbar"
                    [class.high]="z.fossilFreeShare >= 0.85"
                    [class.mid]="z.fossilFreeShare >= 0.5 && z.fossilFreeShare < 0.85"
                    [class.low]="z.fossilFreeShare < 0.5"
                    [style.height.%]="z.fossilFreeShare * 100"
                    [title]="z.label + ' — ' + (z.fossilFreeShare * 100).toFixed(0) + '%'"></span>
            }
          </div>
          <span class="footnote mono">{{ i18n.t('show.tile.grid.foot') }}</span>
        </footer>
      </article>

      <article class="tile ai">
        <header>
          <span class="eyebrow">
            <i-lucide [img]="SparkIcon" [size]="11" [strokeWidth]="2"></i-lucide>
            {{ i18n.t('show.tile.ai') }}
          </span>
          <a class="more" routerLink="/fleet">
            {{ i18n.t('show.tile.try') }} <i-lucide [img]="ArrowRightIcon" [size]="11" [strokeWidth]="2"></i-lucide>
          </a>
        </header>
        <div class="tile-body">
          <p class="ai-line" [innerHTML]="i18n.t('show.tile.ai.body.html')"></p>
          <div class="ai-tags">
            <span class="tag">function_calling</span>
            <span class="tag">claude-sonnet-4.6</span>
            <span class="tag">gpt-5.5</span>
            <span class="tag">JSON-validated</span>
            <span class="tag">fixture fallback</span>
          </div>
        </div>
        <footer>
          <span class="footnote mono">{{ i18n.t('show.tile.ai.foot') }}</span>
        </footer>
      </article>

      <article class="tile arch">
        <header>
          <span class="eyebrow">
            <i-lucide [img]="ServerIcon" [size]="11" [strokeWidth]="2"></i-lucide>
            {{ i18n.t('show.tile.arch') }}
          </span>
        </header>
        <div class="tile-body">
          <pre class="diagram mono" aria-label="Architecture diagram"><code>
 ┌──────────────────────────┐
 │ Angular 18 SPA           │ ◄── you are here
 │  · standalone components │
 │  · signals + computed    │
 └─────────┬────────────────┘
           │ HTTPS · SSE
 ┌─────────▼────────────────┐
 │ Express + TypeScript API │
 │  · zod validation        │
 │  · rate-limit / helmet   │
 │  · prom-client metrics   │
 └─────┬──────────┬─────────┘
       │          │
       ▼          ▼
   SQLite    SCADA sim
   (assets,  (in-process,
    telemetry 5s tick,
    alerts)   IEEE C57.91)
       │
       ▼
   Anthropic Claude (env-gated)
   Energy-Charts API (Fraunhofer ISE, no auth)</code></pre>
        </div>
      </article>
    </section>

    <section class="features">
      <header class="section-head">
        <span class="eyebrow">{{ i18n.t('show.feat.eyebrow') }}</span>
        <h2>{{ i18n.t('show.feat.title') }}</h2>
      </header>

      <div class="feat-grid">
        <article class="feat">
          <header>
            <span class="feat-num mono">01</span>
            <i-lucide [img]="ActivityIcon" [size]="18" [strokeWidth]="1.7" aria-hidden="true"></i-lucide>
            <h3>{{ i18n.t('show.feat1.title') }}</h3>
          </header>
          <p [innerHTML]="i18n.t('show.feat1.body.html')"></p>
          <ul class="bullets">
            <li><span class="b-num">·</span>{{ i18n.t('show.feat1.bullet1') }}</li>
            <li><span class="b-num">·</span>{{ i18n.t('show.feat1.bullet2') }}</li>
            <li><span class="b-num">·</span><span [innerHTML]="i18n.t('show.feat1.bullet3.html')"></span></li>
          </ul>
          <a class="feat-cta" routerLink="/fleet">
            {{ i18n.t('show.feat1.cta') }}
            <i-lucide [img]="ArrowRightIcon" [size]="13" [strokeWidth]="2"></i-lucide>
          </a>
        </article>

        <article class="feat">
          <header>
            <span class="feat-num mono">02</span>
            <i-lucide [img]="LeafIcon" [size]="18" [strokeWidth]="1.7" aria-hidden="true"></i-lucide>
            <h3>{{ i18n.t('show.feat2.title') }}</h3>
          </header>
          <p [innerHTML]="i18n.t('show.feat2.body.html')"></p>
          <ul class="bullets">
            <li><span class="b-num">·</span>{{ i18n.t('show.feat2.bullet1') }}</li>
            <li><span class="b-num">·</span>{{ i18n.t('show.feat2.bullet2') }}</li>
            <li><span class="b-num">·</span>{{ i18n.t('show.feat2.bullet3') }}</li>
          </ul>
          <a class="feat-cta" routerLink="/grid">
            {{ i18n.t('show.feat2.cta') }}
            <i-lucide [img]="ArrowRightIcon" [size]="13" [strokeWidth]="2"></i-lucide>
          </a>
        </article>
      </div>
    </section>

    <section class="stack">
      <header class="section-head">
        <span class="eyebrow">{{ i18n.t('show.stack.eyebrow') }}</span>
        <h2>{{ i18n.t('show.stack.title') }}</h2>
      </header>
      <ul class="badges">
        <li><i-lucide [img]="TriangleIcon" [size]="13" [strokeWidth]="1.8"></i-lucide> Angular 18 · standalone · signals</li>
        <li><i-lucide [img]="CpuIcon" [size]="13" [strokeWidth]="1.8"></i-lucide> TypeScript strict</li>
        <li><i-lucide [img]="ServerIcon" [size]="13" [strokeWidth]="1.8"></i-lucide> Express 4 · zod · helmet</li>
        <li><i-lucide [img]="DatabaseIcon" [size]="13" [strokeWidth]="1.8"></i-lucide> SQLite (better-sqlite3)</li>
        <li><i-lucide [img]="WifiIcon" [size]="13" [strokeWidth]="1.8"></i-lucide> Server-Sent Events</li>
        <li><i-lucide [img]="SparkIcon" [size]="13" [strokeWidth]="1.8"></i-lucide> Anthropic Claude · tool_use</li>
        <li><i-lucide [img]="GlobeIcon" [size]="13" [strokeWidth]="1.8"></i-lucide> Energy-Charts API · live</li>
        <li><i-lucide [img]="ZapIcon" [size]="13" [strokeWidth]="1.8"></i-lucide> Vercel + Railway deploy</li>
      </ul>
    </section>

    <section class="closer">
      <h2>{{ i18n.t('show.closer.title') }}</h2>
      <p>{{ i18n.t('show.closer.body') }}</p>
      <div class="closer-row">
        <a class="cta primary" href="https://github.com/Isidorsson/gridsight" target="_blank" rel="noopener">
          {{ i18n.t('show.closer.cta.github') }}
          <i-lucide [img]="ArrowRightIcon" [size]="13" [strokeWidth]="2"></i-lucide>
        </a>
        <a class="cta" routerLink="/alerts">
          {{ i18n.t('show.closer.cta.alerts') }}
          <i-lucide [img]="ArrowRightIcon" [size]="13" [strokeWidth]="2"></i-lucide>
        </a>
      </div>
    </section>
  `,
  styles: [
    `
      :host { display: block; }

      .hero {
        position: relative;
        margin: -1rem -1.5rem 2rem;
        padding: 3.25rem 1.5rem 3rem;
        overflow: hidden;
        border-bottom: 1px solid var(--gs-border);
        background:
          radial-gradient(800px 400px at 80% 20%, rgba(232,164,92,0.10), transparent 70%),
          radial-gradient(700px 360px at 0% 100%, rgba(124,223,255,0.06), transparent 70%);
      }
      .hero-grid {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(var(--gs-grid-line) 1px, transparent 1px),
          linear-gradient(90deg, var(--gs-grid-line) 1px, transparent 1px);
        background-size: 40px 40px;
        opacity: 0.7;
        pointer-events: none;
        mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
      }
      .hero-content {
        position: relative;
        max-width: 1200px;
        margin: 0 auto;
      }
      .hero h1 {
        margin: 0.7rem 0 1rem;
        font-size: clamp(1.85rem, 3.6vw, 2.85rem);
        line-height: 1.1;
        letter-spacing: -0.025em;
        font-weight: 500;
        color: var(--gs-text-strong);
        max-width: 28ch;
      }
      .hero h1 .hl {
        color: var(--gs-accent-bright);
        font-style: italic;
        font-family: var(--gs-serif);
        font-weight: 400;
      }
      .hero .lede {
        margin: 0 0 1.6rem;
        max-width: 64ch;
        font-size: 1rem;
        color: var(--gs-text-muted);
        line-height: 1.55;
      }
      .cta-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 0.85rem;
        max-width: 720px;
        margin-bottom: 1.6rem;
      }
      .cta {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 1rem;
        padding: 0.95rem 1.1rem;
        background: var(--gs-surface);
        border: 1px solid var(--gs-border);
        border-radius: var(--gs-radius);
        color: var(--gs-text);
        text-decoration: none;
        transition: border-color 0.15s, transform 0.1s, background 0.15s;
      }
      .cta:hover {
        border-color: var(--gs-accent-line);
        text-decoration: none;
        transform: translateY(-1px);
      }
      .cta.primary {
        background: linear-gradient(180deg, var(--gs-brand-soft), transparent 80%), var(--gs-surface);
        border-color: var(--gs-brand);
      }
      .cta.primary:hover { border-color: var(--gs-brand-bright); background: var(--gs-brand-soft); }
      .cta-num {
        font-family: var(--gs-mono);
        font-size: 0.7rem;
        letter-spacing: 0.16em;
        color: var(--gs-text-faint);
      }
      .cta.primary .cta-num { color: var(--gs-accent); }
      .cta-body { display: flex; flex-direction: column; gap: 0.18rem; min-width: 0; }
      .cta-body strong {
        font-weight: 500;
        font-size: 0.95rem;
        letter-spacing: -0.01em;
        color: var(--gs-text-strong);
      }
      .cta-body .sub {
        font-family: var(--gs-mono);
        font-size: 0.66rem;
        letter-spacing: 0.06em;
        color: var(--gs-text-muted);
      }
      .cta i-lucide { color: var(--gs-text-faint); }
      .cta:hover i-lucide { color: var(--gs-accent); transform: translateX(2px); transition: transform 0.15s; }

      .hero-meta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.65rem;
        font-size: 0.66rem;
        letter-spacing: 0.16em;
        color: var(--gs-text-faint);
      }
      .hero-meta .m {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
      }
      .hero-meta .dot {
        width: 6px; height: 6px;
        border-radius: 50%;
        background: var(--gs-text-faint);
      }
      .hero-meta .dot.live {
        background: var(--gs-low);
        box-shadow: 0 0 0 3px rgba(74,222,128,0.18);
        animation: gs-pulse 2.6s ease-in-out infinite;
      }
      .hero-meta .sep { color: var(--gs-accent); opacity: 0.6; }

      .live-board {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
      }
      .tile {
        background: var(--gs-surface);
        border: 1px solid var(--gs-border);
        border-radius: var(--gs-radius-2);
        padding: 1.1rem 1.2rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        position: relative;
        overflow: hidden;
      }
      .tile.fleet { background: linear-gradient(180deg, rgba(232,164,92,0.05), transparent 60%), var(--gs-surface); }
      .tile.grid  { background: linear-gradient(180deg, rgba(124,223,255,0.05), transparent 60%), var(--gs-surface); }
      .tile.ai    { background: linear-gradient(180deg, rgba(167,139,250,0.06), transparent 60%), var(--gs-surface); }
      .tile.arch  { background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent 70%), var(--gs-surface); }

      .tile header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }
      .tile header .eyebrow { font-size: 0.66rem; }
      .tile .more {
        font-family: var(--gs-mono);
        font-size: 0.62rem;
        letter-spacing: 0.16em;
        color: var(--gs-text-muted);
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
      }
      .tile .more:hover { color: var(--gs-accent); text-decoration: none; }

      .tile-body { flex: 1; display: flex; flex-direction: column; gap: 0.85rem; min-height: 0; }
      .big { display: flex; flex-direction: column; gap: 0.15rem; }
      .big .num {
        font-family: var(--gs-mono);
        font-size: 2.2rem;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.025em;
        color: var(--gs-text-strong);
        line-height: 1;
      }
      .big .num em {
        font-style: normal;
        font-size: 0.5em;
        margin-left: 0.1em;
        color: var(--gs-text-faint);
      }
      .big .lbl {
        font-family: var(--gs-mono);
        font-size: 0.66rem;
        letter-spacing: 0.1em;
        color: var(--gs-text-muted);
      }

      .severity-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.35rem 0.85rem;
        font-family: var(--gs-mono);
        font-size: 0.7rem;
        color: var(--gs-text-muted);
        letter-spacing: 0.04em;
      }
      .severity-list li { display: inline-flex; align-items: center; gap: 0.45rem; }
      .severity-list strong { font-variant-numeric: tabular-nums; color: var(--gs-text); font-weight: 500; }
      .severity-list .dot {
        width: 7px; height: 7px; border-radius: 50%;
      }
      .severity-list .dot.critical { background: var(--gs-critical); }
      .severity-list .dot.high     { background: var(--gs-high); }
      .severity-list .dot.medium   { background: var(--gs-medium); }
      .severity-list .dot.low      { background: var(--gs-low); }

      .vs-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        font-family: var(--gs-mono);
        font-size: 0.72rem;
      }
      .vs-list li { display: grid; grid-template-columns: 1fr auto; gap: 0.5rem; align-items: baseline; }
      .vs-list .vs-lab { color: var(--gs-text-faint); letter-spacing: 0.1em; text-transform: uppercase; font-size: 0.6rem; }
      .vs-list strong { color: var(--gs-text); font-weight: 500; font-variant-numeric: tabular-nums; }
      .vs-list .vs-zone { grid-column: 1 / -1; color: var(--gs-text-muted); font-size: 0.66rem; }

      .ai-line { margin: 0; font-size: 0.92rem; line-height: 1.55; color: var(--gs-text-muted); }
      .ai-line strong { color: var(--gs-text); font-weight: 500; }
      .ai-tags { display: flex; flex-wrap: wrap; gap: 0.35rem; }
      .tag {
        font-family: var(--gs-mono);
        font-size: 0.62rem;
        letter-spacing: 0.06em;
        padding: 0.18rem 0.45rem;
        border-radius: 4px;
        background: var(--gs-bg-2);
        color: var(--gs-text-muted);
        border: 1px solid var(--gs-border);
      }

      .diagram {
        font-size: 0.66rem;
        line-height: 1.25;
        color: var(--gs-text-muted);
        margin: 0;
        padding: 0;
        background: transparent;
        white-space: pre;
        overflow: hidden;
      }

      .tile footer {
        margin-top: auto;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .tile footer gs-sparkline {
        display: block;
        height: 32px;
      }
      .tile footer .footnote {
        font-size: 0.6rem;
        letter-spacing: 0.1em;
        color: var(--gs-text-faint);
      }

      .zone-strip {
        display: flex;
        align-items: flex-end;
        gap: 3px;
        height: 32px;
      }
      .zone-strip .zbar {
        flex: 1;
        background: var(--gs-text-faint);
        border-radius: 2px 2px 0 0;
        min-height: 4px;
        opacity: 0.85;
      }
      .zone-strip .zbar.high { background: var(--gs-low); }
      .zone-strip .zbar.mid  { background: var(--gs-medium); }
      .zone-strip .zbar.low  { background: var(--gs-high); }

      .features { margin-bottom: 2rem; }
      .section-head {
        margin-bottom: 1.25rem;
        padding-bottom: 0.85rem;
        border-bottom: 1px solid var(--gs-border);
      }
      .section-head h2 {
        margin: 0.4rem 0 0;
        font-size: 1.25rem;
        font-weight: 500;
        letter-spacing: -0.015em;
        color: var(--gs-text);
      }
      .feat-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
      .feat {
        background: var(--gs-surface);
        border: 1px solid var(--gs-border);
        border-radius: var(--gs-radius-2);
        padding: 1.4rem 1.5rem 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        position: relative;
      }
      .feat::before {
        content: '';
        position: absolute;
        top: 0; bottom: 0; left: 0;
        width: 4px;
        background: var(--gs-brand);
      }
      .feat header {
        display: flex;
        align-items: center;
        gap: 0.65rem;
      }
      .feat-num {
        font-size: 0.66rem;
        letter-spacing: 0.16em;
        color: var(--gs-accent);
        padding: 0.22rem 0.45rem;
        background: var(--gs-accent-soft);
        border: 1px solid var(--gs-accent-line);
        border-radius: 4px;
      }
      .feat header h3 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 500;
        letter-spacing: -0.01em;
        color: var(--gs-text-strong);
      }
      .feat header i-lucide { color: var(--gs-accent); }
      .feat p { margin: 0; font-size: 0.92rem; line-height: 1.55; color: var(--gs-text-muted); }
      .feat strong { color: var(--gs-text); font-weight: 500; }
      .feat code {
        font-family: var(--gs-mono);
        font-size: 0.85em;
        padding: 0.06em 0.32em;
        border-radius: 3px;
        background: var(--gs-bg-2);
        border: 1px solid var(--gs-border);
        color: var(--gs-text);
      }
      .bullets {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        font-size: 0.85rem;
        color: var(--gs-text-muted);
      }
      .bullets li { display: grid; grid-template-columns: 14px 1fr; gap: 0.4rem; align-items: baseline; }
      .bullets .b-num { color: var(--gs-accent); font-family: var(--gs-mono); }
      .feat-cta {
        margin-top: auto;
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.5rem 0.95rem;
        font-family: var(--gs-mono);
        font-size: 0.7rem;
        letter-spacing: 0.14em;
        background: var(--gs-bg-2);
        color: var(--gs-text);
        border: 1px solid var(--gs-border);
        border-radius: 4px;
        align-self: flex-start;
      }
      .feat-cta:hover { border-color: var(--gs-accent); color: var(--gs-accent); text-decoration: none; }

      .stack { margin-bottom: 2rem; }
      .badges {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .badges li {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.4rem 0.7rem;
        background: var(--gs-bg-2);
        border: 1px solid var(--gs-border);
        border-radius: 4px;
        font-family: var(--gs-mono);
        font-size: 0.74rem;
        color: var(--gs-text-muted);
        letter-spacing: 0.04em;
      }
      .badges li i-lucide { color: var(--gs-accent); }

      .closer {
        background: var(--gs-surface);
        border: 1px solid var(--gs-border);
        border-radius: var(--gs-radius-2);
        padding: 2rem 2rem 2.2rem;
        margin-bottom: 1rem;
      }
      .closer h2 {
        margin: 0 0 0.6rem;
        font-size: 1.45rem;
        font-weight: 500;
        letter-spacing: -0.02em;
        color: var(--gs-text-strong);
      }
      .closer p {
        margin: 0 0 1.4rem;
        max-width: 60ch;
        color: var(--gs-text-muted);
        line-height: 1.55;
      }
      .closer-row { display: flex; gap: 0.7rem; flex-wrap: wrap; }

      @media (max-width: 1100px) {
        .live-board { grid-template-columns: 1fr 1fr; }
        .feat-grid { grid-template-columns: 1fr; }
      }
      @media (max-width: 720px) {
        .hero { margin: -1rem -1rem 1.6rem; padding: 2.2rem 1rem 2rem; }
        .live-board { grid-template-columns: 1fr; }
        .cta-row { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class ShowcaseComponent {
  private readonly api = inject(ApiService);
  protected readonly sse = inject(SseService);
  protected readonly i18n = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly ActivityIcon = Activity;
  protected readonly ArrowRightIcon = ArrowRight;
  protected readonly CpuIcon = Cpu;
  protected readonly DatabaseIcon = Database;
  protected readonly GlobeIcon = Globe2;
  protected readonly LeafIcon = Leaf;
  protected readonly RadarIcon = Radar;
  protected readonly ServerIcon = Server;
  protected readonly SparkIcon = Sparkles;
  protected readonly TriangleIcon = Triangle;
  protected readonly WifiIcon = Wifi;
  protected readonly ZapIcon = Zap;

  protected readonly assets = signal<Asset[]>([]);
  protected readonly alerts = signal<Alert[]>([]);
  protected readonly summaries = signal<ZoneSummary[]>([]);

  protected readonly assetCount = computed(() => this.assets().length);

  protected readonly readingsTotalCount = signal(0);
  protected readonly readingsTotal = computed(() => this.readingsTotalCount());

  protected readonly recentRate = signal<number[]>(Array.from({ length: 30 }, () => 0));

  protected readonly openAlertCount = computed(() => this.alerts().filter((a) => a.status === 'open').length);
  protected readonly severityCounts = computed(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const a of this.alerts()) if (a.status === 'open') counts[a.severity]++;
    return counts;
  });

  protected readonly readingsRate = computed(() => this.recentRate());

  protected readonly sortedSummaries = computed(() =>
    [...this.summaries()].sort((a, b) => b.fossilFreeShare - a.fossilFreeShare),
  );
  protected readonly greenestZone = computed(() => this.sortedSummaries()[0] ?? null);
  protected readonly dirtiestZone = computed(() => {
    const s = this.sortedSummaries();
    return s.length ? s[s.length - 1] : null;
  });
  protected readonly priceSpread = computed(() => {
    const prices = this.summaries().map((s) => s.currentPrice);
    if (prices.length < 2) return 0;
    return Math.max(...prices) - Math.min(...prices);
  });

  private readingsThisWindow = 0;

  constructor() {
    this.api.listAssets().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => this.assets.set(r.items),
    });

    this.api.listAlerts('all').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => this.alerts.set(r.items),
    });

    this.api.getGridSummary().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => this.summaries.set(r.items),
    });

    this.sse.telemetry$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.readingsTotalCount.update((n) => n + 1);
      this.readingsThisWindow++;
    });
    this.sse.alerts$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((a) => {
      this.alerts.update((list) => [a, ...list]);
    });

    // Roll sparkline window every ~2s — gives a sense of stream activity.
    const id = window.setInterval(() => {
      const next = [...this.recentRate(), this.readingsThisWindow];
      this.readingsThisWindow = 0;
      if (next.length > 30) next.splice(0, next.length - 30);
      this.recentRate.set(next);
    }, 2000);
    this.destroyRef.onDestroy(() => window.clearInterval(id));
  }

  protected shortZone(label: string): string {
    return label.replace(/\s—.*$/, '').replace(/\s\(.+\)$/, '');
  }

  protected flagEmoji(country: string): string {
    if (country.length !== 2) return '⬜';
    const codePoints = country.toUpperCase().split('').map((c) => 0x1f1a5 + c.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }
}
