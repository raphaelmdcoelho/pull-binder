import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AppLang, LANG_STORAGE_KEY, fromBrowserLanguage, isAppLang } from './languages';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);
  private readonly _current = signal<AppLang>('en');

  readonly current = this._current.asReadonly();

  /** Picks the saved language, else the browser's, and loads it. Runs before first render. */
  async init(): Promise<void> {
    await this.apply(
      this.stored() ?? fromBrowserLanguage(this.document.defaultView?.navigator.language),
    );
  }

  async set(lang: AppLang): Promise<void> {
    await this.apply(lang);
    try {
      this.document.defaultView?.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Storage can be blocked; the choice then lasts for this session only.
    }
  }

  private async apply(lang: AppLang): Promise<void> {
    this.transloco.setActiveLang(lang);
    await firstValueFrom(this.transloco.load(lang));
    this._current.set(lang);
    this.document.documentElement.lang = lang;
  }

  private stored(): AppLang | null {
    try {
      const value = this.document.defaultView?.localStorage.getItem(LANG_STORAGE_KEY);
      return isAppLang(value) ? value : null;
    } catch {
      return null;
    }
  }
}
