/** Languages of the app interface. Not to be confused with the Language printed on a card. */
export const SUPPORTED_LANGS = ['en', 'pt-BR'] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];
export const DEFAULT_LANG: AppLang = 'en';
export const LANG_STORAGE_KEY = 'pb.lang';

export function isAppLang(value: unknown): value is AppLang {
  return typeof value === 'string' && (SUPPORTED_LANGS as readonly string[]).includes(value);
}

/** Maps a browser language tag such as "pt-PT" or "en-GB" to a supported app language. */
export function fromBrowserLanguage(tag: string | undefined): AppLang {
  return tag?.toLowerCase().startsWith('pt') ? 'pt-BR' : DEFAULT_LANG;
}
