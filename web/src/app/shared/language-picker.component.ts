import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { LucideAngularModule, ChevronDown, Check, Languages } from 'lucide-angular';
import { LanguageService } from '../core/i18n/language.service';
import { LANGS, type Lang } from '../core/i18n/translations';

@Component({
  selector: 'gs-language-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="picker" #root>
      <button
        type="button"
        class="trigger"
        [attr.aria-haspopup]="'listbox'"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="i18n.t('app.lang.label') + ': ' + activeLang().label"
        [title]="i18n.t('app.lang.label')"
        (click)="toggle()"
      >
        <i-lucide [img]="LangIcon" [size]="11" [strokeWidth]="2" aria-hidden="true"></i-lucide>
        <span class="flag" aria-hidden="true">{{ activeLang().flag }}</span>
        <span class="code">{{ activeLang().code.toUpperCase() }}</span>
        <i-lucide [img]="ChevronIcon" [size]="11" [strokeWidth]="2" aria-hidden="true"></i-lucide>
      </button>

      @if (open()) {
        <ul class="menu" role="listbox" [attr.aria-label]="i18n.t('app.lang.label')">
          @for (l of langs; track l.code) {
            <li>
              <button
                type="button"
                role="option"
                [attr.aria-selected]="l.code === i18n.lang()"
                [class.active]="l.code === i18n.lang()"
                (click)="select(l.code)"
              >
                <span class="flag" aria-hidden="true">{{ l.flag }}</span>
                <span class="lbl">{{ l.label }}</span>
                <span class="code">{{ l.code.toUpperCase() }}</span>
                @if (l.code === i18n.lang()) {
                  <i-lucide
                    [img]="CheckIcon"
                    [size]="12"
                    [strokeWidth]="2.2"
                    class="check"
                    aria-hidden="true"
                  ></i-lucide>
                }
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      .picker {
        position: relative;
        display: inline-block;
      }
      .trigger {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.28rem 0.55rem;
        border: 1px solid var(--gs-border-2);
        border-radius: 4px;
        background: transparent;
        cursor: pointer;
        font-family: var(--gs-mono);
        font-size: 0.66rem;
        letter-spacing: 0.14em;
        font-weight: 600;
        color: var(--gs-text-muted);
        transition: border-color 0.15s, color 0.15s, background 0.15s;
      }
      .trigger:hover {
        border-color: var(--gs-accent-line);
        color: var(--gs-accent);
        background: var(--gs-accent-soft);
      }
      .trigger .flag {
        font-size: 0.85rem;
        line-height: 1;
      }
      .trigger .code {
        font-variant-numeric: tabular-nums;
      }

      .menu {
        position: absolute;
        right: 0;
        top: calc(100% + 6px);
        z-index: 50;
        min-width: 160px;
        margin: 0;
        padding: 0.25rem;
        list-style: none;
        background: color-mix(in oklab, var(--gs-bg) 92%, black);
        border: 1px solid var(--gs-border);
        border-radius: var(--gs-radius);
        box-shadow: var(--gs-shadow-soft, 0 8px 32px rgba(0, 0, 0, 0.45));
        backdrop-filter: blur(10px);
      }
      .menu li {
        margin: 0;
      }
      .menu button {
        width: 100%;
        display: grid;
        grid-template-columns: auto 1fr auto auto;
        align-items: center;
        gap: 0.55rem;
        padding: 0.45rem 0.6rem;
        background: transparent;
        border: 0;
        color: var(--gs-text);
        font-family: inherit;
        font-size: 0.82rem;
        text-align: left;
        cursor: pointer;
        border-radius: var(--gs-radius-3);
        transition: background 0.12s, color 0.12s;
      }
      .menu button:hover {
        background: var(--gs-surface-2);
      }
      .menu button.active {
        background: var(--gs-accent-soft);
        color: var(--gs-accent-bright);
      }
      .menu .flag {
        font-size: 1rem;
        line-height: 1;
      }
      .menu .lbl {
        font-weight: 500;
      }
      .menu .code {
        font-family: var(--gs-mono);
        font-size: 0.66rem;
        letter-spacing: 0.12em;
        color: var(--gs-text-faint);
      }
      .menu button.active .code {
        color: var(--gs-accent);
      }
      .menu .check {
        color: var(--gs-accent);
      }
    `,
  ],
})
export class LanguagePickerComponent {
  protected readonly i18n = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly LangIcon = Languages;
  protected readonly ChevronIcon = ChevronDown;
  protected readonly CheckIcon = Check;

  protected readonly langs = LANGS;
  protected readonly open = signal(false);

  protected readonly activeLang = (): (typeof LANGS)[number] =>
    LANGS.find((l) => l.code === this.i18n.lang()) ?? LANGS[0]!;

  @ViewChild('root', { static: true }) private rootEl!: ElementRef<HTMLElement>;

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  protected select(code: Lang): void {
    this.i18n.setLang(code);
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  protected onDocClick(ev: MouseEvent): void {
    if (!this.open()) return;
    const target = ev.target as Node | null;
    if (target && !this.rootEl.nativeElement.contains(target)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected onEsc(): void {
    if (this.open()) this.open.set(false);
  }
}
