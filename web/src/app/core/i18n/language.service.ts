import { Injectable, signal } from '@angular/core';
import { DICTS, EN, type Lang, type TranslationKey } from './translations';

const STORAGE_KEY = 'gs.lang';

const DEFAULT_LANG: Lang = 'en';

function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'en' || v === 'sv') return v;
  } catch {
    /* private mode etc — non-fatal */
  }
  return DEFAULT_LANG;
}

@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly lang = signal<Lang>(readStoredLang());

  constructor() {
    try {
      document.documentElement.lang = this.lang();
    } catch {
      /* SSR or non-DOM env — non-fatal */
    }
  }

  setLang(lang: Lang): void {
    if (lang === this.lang()) return;
    this.lang.set(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch {
      /* private mode etc — non-fatal */
    }
  }

  /**
   * Translate a key to the active locale. Reads `lang()` so any template that
   * calls this is automatically tracked by Angular's signal-aware change
   * detection — switching language re-renders consumers without manual
   * `markForCheck`. Falls back to English when a key is missing in the
   * non-default dictionary.
   */
  t(key: TranslationKey): string {
    const dict = DICTS[this.lang()];
    return dict[key] ?? EN[key];
  }
}
