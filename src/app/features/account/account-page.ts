import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { GrButton } from '@grass-ds/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { CollectionStore } from '../../collection/collection.store';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { SUPPORTED_LANGS, isAppLang } from '../../core/i18n/languages';
import { PbSelect } from '../../shared/ui/select/select';

@Component({
  selector: 'pb-account-page',
  imports: [TranslocoPipe, PbSelect, GrButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gr-stack">
      <h1 class="gr-display">{{ 'account.title' | transloco }}</h1>

      @if (auth.user(); as user) {
        <section class="gr-card" aria-labelledby="account-who">
          <div class="gr-card__body gr-stack">
            <h2 class="gr-card__title" id="account-who">{{ auth.displayName() }}</h2>
            <p class="gr-text-muted">{{ 'account.email' | transloco }}: {{ user.email }}</p>
          </div>
        </section>
      }

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

      <button grButton variant="secondary" type="button" (click)="signOut()">
        {{ 'auth.signOut' | transloco }}
      </button>
    </div>
  `,
})
export class AccountPage {
  protected readonly auth = inject(AuthService);
  protected readonly language = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly collection = inject(CollectionStore);
  protected readonly langs = SUPPORTED_LANGS;

  protected onChange(value: string): void {
    if (isAppLang(value)) void this.language.set(value);
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    this.collection.reset();
    await this.router.navigateByUrl('/login');
  }
}
