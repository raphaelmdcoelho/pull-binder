import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { RouterTestingHarness } from '@angular/router/testing';
import { createFakeSupabase, provideFakeSupabase, sessionFor } from '../testing/fake-supabase';
import { provideTestI18n } from '../testing/transloco';
import { AuthService } from './core/auth/auth.service';
import { LanguageService } from './core/i18n/language.service';
import { FakeCatalog, provideFakeCatalog } from '../testing/fake-catalog';
import { FakeOwnedCards, provideFakeOwnedCards } from '../testing/fake-owned-cards';
import { App } from './app';
import { routes } from './app.routes';

async function setup(signedIn: boolean) {
  localStorage.clear();
  TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideRouter(routes),
      provideServiceWorker('ngsw-worker.js', { enabled: false }),
      provideTestI18n(),
      provideFakeCatalog(new FakeCatalog()),
      provideFakeOwnedCards(new FakeOwnedCards()),
      provideFakeSupabase(createFakeSupabase(signedIn ? sessionFor() : null)),
    ],
  });
  await TestBed.inject(AuthService).init();
  await TestBed.inject(LanguageService).set('en');
  return TestBed.createComponent(App);
}

describe('App', () => {
  it('renders the shell with a three-link tab bar when signed in', async () => {
    const fixture = await setup(true);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('main')).toBeTruthy();
    expect(Array.from(root.querySelectorAll('nav a')).map((a) => a.textContent?.trim())).toEqual([
      'Search',
      'Collection',
      'Account',
    ]);
  });

  it('hides the tab bar when signed out', async () => {
    const fixture = await setup(false);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('nav')).toBeNull();
  });

  it('marks the active tab with aria-current and follows navigation', async () => {
    const fixture = await setup(true);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/collection');
    await fixture.whenStable();
    const current = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '[aria-current="page"]',
    );
    expect(current.length).toBe(1);
    expect(current[0].textContent).toContain('Collection');
  });

  it('redirects a signed-out visitor from a private page to /login', async () => {
    await setup(false);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/collection');
    expect(TestBed.inject(Router).url).toContain('/login?returnUrl=%2Fcollection');
  });

  it('switches the interface to pt-BR and updates <html lang>', async () => {
    const fixture = await setup(true);
    await TestBed.inject(LanguageService).set('pt-BR');
    await fixture.whenStable();
    const labels = (fixture.nativeElement as HTMLElement).querySelectorAll('nav a');
    expect(labels[0].textContent?.trim()).toBe('Buscar');
    expect(document.documentElement.lang).toBe('pt-BR');
  });
});
