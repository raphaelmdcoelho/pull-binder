import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../../core/i18n/language.service';
import { AppLang, SUPPORTED_LANGS, isAppLang } from '../../core/i18n/languages';
import { PbSelect } from '../../shared/ui/select/select';

@Component({
  selector: 'pb-account-page',
  imports: [TranslocoPipe, PbSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gr-stack">
      <h1 class="gr-display">{{ 'account.title' | transloco }}</h1>
      <div class="gr-field">
        <label class="gr-field__label" for="app-language">{{
          'account.language' | transloco
        }}</label>
        <p class="gr-field__hint" id="app-language-hint">
          {{ 'account.languageHint' | transloco }}
        </p>
        <select
          pbSelect
          id="app-language"
          aria-describedby="app-language-hint"
          (change)="onChange($any($event.target).value)"
        >
          @for (lang of langs; track lang) {
            <option [value]="lang" [selected]="lang === language.current()">
              {{ 'account.lang.' + lang | transloco }}
            </option>
          }
        </select>
      </div>
    </div>
  `,
})
export class AccountPage {
  protected readonly language = inject(LanguageService);
  protected readonly langs = SUPPORTED_LANGS;

  protected onChange(value: string): void {
    if (isAppLang(value)) void this.language.set(value as AppLang);
  }
}
