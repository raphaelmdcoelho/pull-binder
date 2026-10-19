import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CatalogError } from '../../catalog/catalog.service';
import { LanguageService } from '../../core/i18n/language.service';
import { FakeCatalog, page, provideFakeCatalog, summary } from '../../../testing/fake-catalog';
import { provideTestI18n } from '../../../testing/transloco';
import { SearchPage } from './search-page';
import { SearchStore } from './search.store';

async function setup() {
  localStorage.clear();
  const fake = new FakeCatalog();
  TestBed.configureTestingModule({
    imports: [SearchPage],
    providers: [provideRouter([]), provideTestI18n(), provideFakeCatalog(fake)],
  });
  await TestBed.inject(LanguageService).set('en');
  const fixture = TestBed.createComponent(SearchPage);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const store = TestBed.inject(SearchStore);
  const run = async (query: string) => {
    await store.search(query);
    fixture.detectChanges();
  };
  return { fake, fixture, el, store, run };
}

describe('SearchPage', () => {
  it('shows the hint before searching', async () => {
    const { el } = await setup();
    expect(el.textContent).toContain('Type at least 2 letters');
  });

  it('renders results as links with alt text and lazy images', async () => {
    const { fake, el, run } = await setup();
    fake.searchImpl = async () => page([summary('base1-4', 'Charizard', '4')]);
    await run('char');
    const link = el.querySelector<HTMLAnchorElement>('a.pb-card-grid__link')!;
    expect(link.getAttribute('href')).toBe('/card/base1-4');
    const img = el.querySelector('img')!;
    expect(img.getAttribute('alt')).toBe('Charizard 4');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('src')).toBe('https://img.test/base1-4/low.webp');
    expect(el.querySelector('[aria-live="polite"]')?.textContent).toContain('1 cards shown');
  });

  it('shows the empty state with the query', async () => {
    const { el, run } = await setup();
    await run('zzzz');
    expect(el.textContent).toContain('No cards found');
    expect(el.textContent).toContain('"zzzz"');
  });

  it('shows an alert and a retry button on error', async () => {
    const { fake, el, run } = await setup();
    fake.searchImpl = async () => {
      throw new CatalogError('network');
    };
    await run('pika');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain("Can't reach the catalog");
    expect(
      Array.from(el.querySelectorAll('button')).some((b) => b.textContent?.includes('Try again')),
    ).toBe(true);
  });

  it('offers Load more only while there are more pages', async () => {
    const { fake, el, run } = await setup();
    fake.searchImpl = async () => page([summary('a', 'A')], { hasMore: true });
    await run('ab');
    expect(
      Array.from(el.querySelectorAll('button')).some((b) => b.textContent?.includes('Load more')),
    ).toBe(true);
  });

  it('says so when results fell back to English', async () => {
    const { fake, el, run } = await setup();
    fake.searchImpl = async () => page([summary('a', 'A')], { fellBackToEnglish: true });
    await run('ab');
    expect(el.querySelector('[role="status"]')?.textContent).toContain('in English');
  });

  it('renders in Portuguese', async () => {
    const { el, fixture } = await setup();
    await TestBed.inject(LanguageService).set('pt-BR');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('Digite pelo menos 2 letras');
  });
});
