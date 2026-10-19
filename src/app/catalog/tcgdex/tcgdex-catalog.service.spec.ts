import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CATALOG_PERSISTENCE, PersistentStore } from '../catalog.cache';
import { CatalogError, CatalogService } from '../catalog.service';
import { PAGE_SIZE, TcgdexCatalogService, toFinishes } from './tcgdex-catalog.service';
import { provideCatalog } from '../catalog.providers';

const API = 'https://api.tcgdex.net/v2';

function memoryStore(): PersistentStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return { data, get: async (k) => data.get(k), set: async (k, v) => void data.set(k, v) };
}

function setup(persistence: PersistentStore | null = null) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideCatalog(),
      { provide: CATALOG_PERSISTENCE, useValue: persistence },
    ],
  });
  return {
    service: TestBed.inject(CatalogService) as TcgdexCatalogService,
    http: TestBed.inject(HttpTestingController),
  };
}

const brief = (n: number) => ({
  id: `s-${n}`,
  localId: `${n}`,
  name: `Card ${n}`,
  image: `https://assets.test/${n}`,
});

describe('TcgdexCatalogService', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('searches by name with pagination and maps cards', async () => {
    const { service, http } = setup();
    const result = service.searchCards({ query: ' pika ', lang: 'en', page: 2 });
    await Promise.resolve();
    const req = http.expectOne((r) => r.url === `${API}/en/cards`);
    expect(req.request.params.get('name')).toBe('pika');
    expect(req.request.params.get('pagination:page')).toBe('2');
    expect(req.request.params.get('pagination:itemsPerPage')).toBe(`${PAGE_SIZE}`);
    req.flush([brief(1), { id: 'x-2', localId: '2', name: 'No image' }]);
    const page = await result;
    expect(page.cards[1]).toEqual({ id: 'x-2', number: '2', name: 'No image', imageBase: null });
    expect(page.cards[0].imageBase).toBe('https://assets.test/1');
    expect(page.hasMore).toBe(false);
    expect(page.lang).toBe('en');
  });

  it('reports more pages only when a page is full', async () => {
    const { service, http } = setup();
    const result = service.searchCards({ query: 'ch', lang: 'en', page: 1 });
    await Promise.resolve();
    http
      .expectOne((r) => r.url === `${API}/en/cards`)
      .flush(Array.from({ length: PAGE_SIZE }, (_, i) => brief(i)));
    expect((await result).hasMore).toBe(true);
  });

  it('falls back to English when the first page is empty in another language', async () => {
    const { service, http } = setup();
    const result = service.searchCards({ query: 'charizard', lang: 'pt', page: 1 });
    await Promise.resolve();
    http.expectOne((r) => r.url === `${API}/pt/cards`).flush([]);
    await vi.waitFor(() => http.expectOne((r) => r.url === `${API}/en/cards`).flush([brief(4)]));
    const page = await result;
    expect(page.fellBackToEnglish).toBe(true);
    expect(page.lang).toBe('en');
    expect(page.cards).toHaveLength(1);
  });

  it('does not fall back on page 2 or when English is empty', async () => {
    const { service, http } = setup();
    const result = service.searchCards({ query: 'zzz', lang: 'en', page: 1 });
    await Promise.resolve();
    http.expectOne((r) => r.url === `${API}/en/cards`).flush([]);
    expect((await result).cards).toEqual([]);
  });

  it('serves a repeated search from the cache without a request', async () => {
    const { service, http } = setup();
    const first = service.searchCards({ query: 'Pika', lang: 'en', page: 1 });
    await Promise.resolve();
    http.expectOne((r) => r.url === `${API}/en/cards`).flush([brief(1)]);
    await first;
    const second = await service.searchCards({ query: 'pika', lang: 'en', page: 1 });
    expect(second.cards[0].id).toBe('s-1');
    http.expectNone((r) => r.url.startsWith(API));
  });

  it('persists to the store and reads it back in a fresh cache', async () => {
    const store = memoryStore();
    const { service, http } = setup(store);
    const first = service.searchCards({ query: 'pika', lang: 'en', page: 1 });
    await vi.waitFor(() => http.expectOne((r) => r.url === `${API}/en/cards`).flush([brief(1)]));
    await first;
    expect(store.data.size).toBe(1);
  });

  it('returns stale data when the network fails', async () => {
    const store = memoryStore();
    store.data.set('search:en:1:pika', {
      at: 0,
      value: {
        cards: [],
        page: 1,
        hasMore: false,
        lang: 'en',
        fellBackToEnglish: false,
        marker: 'stale',
      },
    });
    const { service, http } = setup(store);
    const result = service.searchCards({ query: 'pika', lang: 'en', page: 1 });
    await vi.waitFor(() =>
      http
        .expectOne((r) => r.url === `${API}/en/cards`)
        .error(new ProgressEvent('error'), { status: 0 }),
    );
    expect(await result).toMatchObject({ marker: 'stale' });
  });

  it('throws a network CatalogError when offline with nothing cached', async () => {
    const { service, http } = setup();
    const result = service.searchCards({ query: 'pika', lang: 'en', page: 1 });
    await vi.waitFor(() =>
      http
        .expectOne((r) => r.url === `${API}/en/cards`)
        .error(new ProgressEvent('error'), { status: 0 }),
    );
    await expect(result).rejects.toMatchObject({ code: 'network' });
    await expect(result).rejects.toBeInstanceOf(CatalogError);
  });

  it('treats the 504 the service worker answers for a dead network as a network error', async () => {
    const { service, http } = setup();
    const result = service.searchCards({ query: 'pika', lang: 'en', page: 1 });
    await vi.waitFor(() =>
      http
        .expectOne((r) => r.url === `${API}/en/cards`)
        .flush('', { status: 504, statusText: 'Gateway Timeout' }),
    );
    await expect(result).rejects.toMatchObject({ code: 'network' });
  });

  it('maps a card with its set, rarity and finishes', async () => {
    const { service, http } = setup();
    const result = service.getCard('base1-4', 'en');
    await vi.waitFor(() =>
      http.expectOne(`${API}/en/cards/base1-4`).flush({
        ...brief(4),
        id: 'base1-4',
        rarity: 'Rare',
        illustrator: 'Arita',
        set: { id: 'base1', name: 'Base Set' },
        variants: { normal: false, holo: true, reverse: false, firstEdition: true },
      }),
    );
    expect(await result).toMatchObject({
      id: 'base1-4',
      setName: 'Base Set',
      rarity: 'Rare',
      finishes: ['holo', 'other'],
      lang: 'en',
    });
  });

  it('falls back to English when a card does not exist in the language', async () => {
    const { service, http } = setup();
    const result = service.getCard('base1-4', 'pt');
    await vi.waitFor(() =>
      http.expectOne(`${API}/pt/cards/base1-4`).flush({}, { status: 404, statusText: 'Not Found' }),
    );
    await vi.waitFor(() =>
      http.expectOne(`${API}/en/cards/base1-4`).flush({ ...brief(4), id: 'base1-4' }),
    );
    expect(await result).toMatchObject({ lang: 'en', finishes: ['normal'] });
  });

  it('reports not-found when English has no such card', async () => {
    const { service, http } = setup();
    const result = service.getCard('nope', 'en');
    await vi.waitFor(() =>
      http.expectOne(`${API}/en/cards/nope`).flush({}, { status: 404, statusText: 'Not Found' }),
    );
    await expect(result).rejects.toMatchObject({ code: 'not-found' });
  });
});

describe('toFinishes', () => {
  it('defaults to normal and maps reverse to reverse_holo', () => {
    expect(toFinishes(undefined)).toEqual(['normal']);
    expect(toFinishes({ normal: true, reverse: true })).toEqual(['normal', 'reverse_holo']);
  });
});
