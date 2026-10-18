import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTestI18n } from '../testing/transloco';
import { LanguageService } from './core/i18n/language.service';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideTestI18n()],
    }).compileComponents();
    await TestBed.inject(LanguageService).set('en');
  });

  it('renders the shell with a three-link tab bar', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('main')).toBeTruthy();
    const links = root.querySelectorAll('nav a');
    expect(Array.from(links).map((a) => a.textContent?.trim())).toEqual([
      'Search',
      'Collection',
      'Account',
    ]);
  });

  it('marks the active tab with aria-current and follows navigation', async () => {
    const harness = await RouterTestingHarness.create();
    const fixture = TestBed.createComponent(App);
    await harness.navigateByUrl('/collection');
    await fixture.whenStable();
    const current = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '[aria-current="page"]',
    );
    expect(current.length).toBe(1);
    expect(current[0].textContent).toContain('Collection');
  });

  it('switches the interface to pt-BR and updates <html lang>', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(LanguageService).set('pt-BR');
    await fixture.whenStable();
    const labels = (fixture.nativeElement as HTMLElement).querySelectorAll('nav a');
    expect(labels[0].textContent?.trim()).toBe('Buscar');
    expect(document.documentElement.lang).toBe('pt-BR');
  });
});
