import { fromBrowserLanguage, isAppLang } from './languages';

describe('languages', () => {
  it('maps any Portuguese browser tag to pt-BR', () => {
    expect(fromBrowserLanguage('pt-PT')).toBe('pt-BR');
    expect(fromBrowserLanguage('pt')).toBe('pt-BR');
  });

  it('falls back to English', () => {
    expect(fromBrowserLanguage('fr-FR')).toBe('en');
    expect(fromBrowserLanguage(undefined)).toBe('en');
  });

  it('validates stored values', () => {
    expect(isAppLang('pt-BR')).toBe(true);
    expect(isAppLang('pt')).toBe(false);
    expect(isAppLang(null)).toBe(false);
  });
});
