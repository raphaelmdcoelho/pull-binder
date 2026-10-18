import { TestBed } from '@angular/core/testing';
import { provideTestI18n } from '../../../testing/transloco';
import { LanguageService } from './language.service';
import { LANG_STORAGE_KEY } from './languages';

describe('LanguageService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTestI18n()] });
  });

  it('uses the saved language over the browser language', async () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'pt-BR');
    const service = TestBed.inject(LanguageService);
    await service.init();
    expect(service.current()).toBe('pt-BR');
    expect(document.documentElement.lang).toBe('pt-BR');
  });

  it('ignores an unsupported saved value', async () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'xx');
    const service = TestBed.inject(LanguageService);
    await service.init();
    expect(['en', 'pt-BR']).toContain(service.current());
  });

  it('persists the choice', async () => {
    const service = TestBed.inject(LanguageService);
    await service.set('pt-BR');
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('pt-BR');
  });
});
