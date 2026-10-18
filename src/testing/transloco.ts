import { Injectable } from '@angular/core';
import { Translation, TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import en from '../../public/i18n/en.json';
import ptBR from '../../public/i18n/pt-BR.json';

const TRANSLATIONS: Record<string, Translation> = { en, 'pt-BR': ptBR };

@Injectable()
class InlineLoader implements TranslocoLoader {
  getTranslation(lang: string) {
    return of(TRANSLATIONS[lang] ?? {});
  }
}

/** Real Transloco with the shipped JSON files, no HTTP. */
export function provideTestI18n(): ReturnType<typeof provideTransloco> {
  return provideTransloco({
    config: {
      availableLangs: ['en', 'pt-BR'],
      defaultLang: 'en',
      fallbackLang: 'en',
      prodMode: true,
    },
    loader: InlineLoader,
  });
}
