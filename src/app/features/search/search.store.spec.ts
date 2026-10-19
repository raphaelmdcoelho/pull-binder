import { TestBed } from '@angular/core/testing';
import { CatalogError } from '../../catalog/catalog.service';
import { LanguageService } from '../../core/i18n/language.service';
import { FakeCatalog, page, provideFakeCatalog, summary } from '../../../testing/fake-catalog';
import { provideTestI18n } from '../../../testing/transloco';
import { SearchStore } from './search.store';

async function setup() {
  localStorage.clear();
  const fake = new FakeCatalog();
  TestBed.configureTestingModule({ providers: [provideTestI18n(), provideFakeCatalog(fake)] });
  await TestBed.inject(LanguageService).set('en');
  return { fake, store: TestBed.inject(SearchStore) };
}

describe('SearchStore', () => {
  it('stays idle for queries shorter than two characters', async () => {
    const { fake, store } = await setup();
    await store.search('p');
    expect(store.status()).toBe('idle');
    expect(store.tooShort()).toBe(true);
    expect(fake.searches).toEqual([]);
  });

  it('searches in the UI language mapped to the catalog code', async () => {
    const { fake, store } = await setup();
    await TestBed.inject(LanguageService).set('pt-BR');
    fake.searchImpl = async () => page([summary('a', 'Pikachu')], { lang: 'pt' });
    await store.search(' pika ');
    expect(fake.searches).toEqual([{ query: 'pika', lang: 'pt', page: 1 }]);
    expect(store.status()).toBe('loaded');
    expect(store.cards()).toHaveLength(1);
  });

  it('is empty when nothing matches', async () => {
    const { store } = await setup();
    await store.search('zzzz');
    expect(store.isEmpty()).toBe(true);
  });

  it('exposes the English fallback and keeps using that language for more pages', async () => {
    const { fake, store } = await setup();
    await TestBed.inject(LanguageService).set('pt-BR');
    fake.searchImpl = async (r) =>
      r.page === 1
        ? page([summary('a', 'A')], { lang: 'en', hasMore: true, fellBackToEnglish: true })
        : page([summary('b', 'B')], { page: 2, lang: 'en' });
    await store.search('card');
    expect(store.fellBackToEnglish()).toBe(true);
    await store.loadMore();
    expect(fake.searches.at(-1)).toEqual({ query: 'card', lang: 'en', page: 2 });
    expect(store.cards().map((c) => c.id)).toEqual(['a', 'b']);
    expect(store.hasMore()).toBe(false);
  });

  it('does not duplicate cards when pages overlap', async () => {
    const { fake, store } = await setup();
    fake.searchImpl = async (r) =>
      page([summary('a', 'A'), ...(r.page === 2 ? [summary('b', 'B')] : [])], {
        page: r.page,
        hasMore: r.page === 1,
      });
    await store.search('ab');
    await store.loadMore();
    expect(store.cards().map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('shows an error and retries', async () => {
    const { fake, store } = await setup();
    fake.searchImpl = async () => {
      throw new CatalogError('network');
    };
    await store.search('pika');
    expect(store.status()).toBe('error');
    expect(store.error()?.code).toBe('network');
    fake.searchImpl = async () => page([summary('a', 'A')]);
    await store.retry();
    expect(store.status()).toBe('loaded');
    expect(store.error()).toBeNull();
  });

  it('drops the answer to an older query', async () => {
    const { fake, store } = await setup();
    let release!: () => void;
    fake.searchImpl = (r) =>
      r.query === 'old'
        ? new Promise((resolve) => (release = () => resolve(page([summary('old', 'Old')]))))
        : Promise.resolve(page([summary('new', 'New')]));
    const slow = store.search('old');
    await store.search('new');
    release();
    await slow;
    expect(store.cards().map((c) => c.id)).toEqual(['new']);
  });

  it('keeps cards and surfaces an error when loading more fails', async () => {
    const { fake, store } = await setup();
    fake.searchImpl = async (r) => {
      if (r.page === 2) throw new CatalogError('network');
      return page([summary('a', 'A')], { hasMore: true });
    };
    await store.search('ab');
    await store.loadMore();
    expect(store.cards()).toHaveLength(1);
    expect(store.error()?.code).toBe('network');
    expect(store.status()).toBe('loaded');
  });
});
