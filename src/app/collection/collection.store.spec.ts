import { TestBed } from '@angular/core/testing';
import { FakeOwnedCards, ownedCard, provideFakeOwnedCards } from '../../testing/fake-owned-cards';
import { OwnedCardsError } from './owned-cards.repository';
import { CollectionStore, PAGE_SIZE } from './collection.store';

function setup(rows = [] as ReturnType<typeof ownedCard>[]) {
  const fake = new FakeOwnedCards();
  fake.rows = rows;
  TestBed.configureTestingModule({ providers: [provideFakeOwnedCards(fake)] });
  return { fake, store: TestBed.inject(CollectionStore) };
}

const many = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    ownedCard({
      id: `r${i}`,
      cardId: `c${i}`,
      cardName: `Card ${String(i).padStart(3, '0')}`,
      updatedAt: new Date(2026, 0, 1, 0, 0, n - i).toISOString(),
    }),
  );

describe('CollectionStore', () => {
  it('is empty (not filtered-empty) when nothing is owned', async () => {
    const { store } = setup();
    await store.ensureLoaded();
    expect(store.isEmpty()).toBe(true);
    expect(store.isFilteredEmpty()).toBe(false);
    expect(store.summary()).toEqual({ entries: 0, copies: 0 });
  });

  it('summarises entries and copies for everything, not only the loaded page', async () => {
    const { store } = setup(many(PAGE_SIZE + 5).map((r) => ({ ...r, quantity: 2 })));
    await store.ensureLoaded();
    expect(store.cards()).toHaveLength(PAGE_SIZE);
    expect(store.hasMore()).toBe(true);
    expect(store.summary()).toEqual({ entries: PAGE_SIZE + 5, copies: (PAGE_SIZE + 5) * 2 });
  });

  it('loads more pages without duplicates until the end', async () => {
    const { fake, store } = setup(many(PAGE_SIZE + 5));
    await store.ensureLoaded();
    await store.loadMore();
    expect(store.cards()).toHaveLength(PAGE_SIZE + 5);
    expect(store.hasMore()).toBe(false);
    expect(fake.listCalls.at(-1)).toMatchObject({ offset: PAGE_SIZE });
    await store.loadMore();
    expect(fake.listCalls).toHaveLength(2);
  });

  it('keeps the loaded cards and reports the error when load more fails', async () => {
    const { fake, store } = setup(many(PAGE_SIZE + 5));
    await store.ensureLoaded();
    fake.listImpl = async () => {
      throw new OwnedCardsError('network');
    };
    await store.loadMore();
    expect(store.cards()).toHaveLength(PAGE_SIZE);
    expect(store.loadMoreError()?.code).toBe('network');
    expect(store.status()).toBe('loaded');
  });

  it('filters on the server side and the summary follows the filters', async () => {
    const { fake, store } = setup([
      ownedCard({ id: '1', cardName: 'Pikachu', setId: 'a', setName: 'A', quantity: 3 }),
      ownedCard({
        id: '2',
        cardName: 'Charizard',
        setId: 'b',
        setName: 'B',
        quantity: 1,
        condition: 'damaged',
      }),
      ownedCard({
        id: '3',
        cardName: 'Pichu',
        setId: 'a',
        setName: 'A',
        quantity: 2,
        language: 'ja',
      }),
    ]);
    await store.ensureLoaded();
    await store.setText('pi');
    expect(
      store
        .cards()
        .map((c) => c.id)
        .sort(),
    ).toEqual(['1', '3']);
    expect(store.summary()).toEqual({ entries: 2, copies: 5 });
    await store.setLanguage('ja');
    expect(store.cards().map((c) => c.id)).toEqual(['3']);
    expect(fake.listCalls.at(-1)?.query).toMatchObject({ text: 'pi', language: 'ja' });
    expect(store.activeFilterCount()).toBe(1);
    await store.clearFilters();
    expect(store.cards()).toHaveLength(3);
    expect(store.filtersActive()).toBe(false);
  });

  it('distinguishes a filter that hides everything from an empty Collection', async () => {
    const { store } = setup([ownedCard({ id: '1' })]);
    await store.ensureLoaded();
    await store.setCondition('damaged');
    expect(store.isFilteredEmpty()).toBe(true);
    expect(store.isEmpty()).toBe(false);
  });

  it('offers the sets owned and sorts', async () => {
    const { store } = setup([
      ownedCard({ id: '1', cardName: 'B card', setId: 'z', setName: 'Zeta', quantity: 1 }),
      ownedCard({ id: '2', cardName: 'A card', setId: 'a', setName: 'Alpha', quantity: 5 }),
    ]);
    await store.ensureLoaded();
    expect(store.sets().map((s) => s.name)).toEqual(['Alpha', 'Zeta']);
    await store.setSort('name');
    expect(store.cards().map((c) => c.cardName)).toEqual(['A card', 'B card']);
    await store.setSort('quantity');
    expect(store.cards().map((c) => c.id)).toEqual(['2', '1']);
    await store.setSort('set');
    expect(store.cards().map((c) => c.setName)).toEqual(['Alpha', 'Zeta']);
  });

  it('keeps the list on screen while a filter reloads it', async () => {
    const { fake, store } = setup([ownedCard({ id: '1' })]);
    await store.ensureLoaded();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const original = fake.list.bind(fake);
    fake.listImpl = async (q, p) => {
      await gate;
      fake.listImpl = null;
      return original(q, p);
    };
    const pending = store.setText('char');
    expect(store.status()).toBe('loaded');
    expect(store.refreshing()).toBe(true);
    release();
    await pending;
    expect(store.refreshing()).toBe(false);
  });

  it('drops the answer to an older filter', async () => {
    const { fake, store } = setup([
      ownedCard({ id: '1', cardName: 'Old' }),
      ownedCard({ id: '2', cardName: 'New' }),
    ]);
    await store.ensureLoaded();
    let release!: () => void;
    fake.listImpl = (q, p) =>
      q.text === 'old'
        ? new Promise(
            (resolve) => (release = () => resolve(fake.defaultList({ ...q, text: 'Old' }, p))),
          )
        : Promise.resolve(fake.defaultList(q, p));
    const slow = store.setText('old');
    await store.setText('new');
    release();
    await slow;
    expect(store.cards().map((c) => c.cardName)).toEqual(['New']);
  });

  it('shows an error and recovers on reload', async () => {
    const { fake, store } = setup();
    fake.listImpl = async () => {
      throw new OwnedCardsError('network');
    };
    await store.ensureLoaded();
    expect(store.status()).toBe('error');
    expect(store.error()?.code).toBe('network');
    fake.listImpl = null;
    await store.reload();
    expect(store.status()).toBe('loaded');
  });

  it('patches the list in place after an edit and refreshes the summary', async () => {
    const { store } = setup([
      ownedCard({ id: '1', quantity: 1 }),
      ownedCard({ id: '2', cardId: 'x', quantity: 1 }),
    ]);
    await store.ensureLoaded();
    const card = store.cards().find((c) => c.id === '1')!;
    const result = await store.update(card, { quantity: 4 });
    expect(result.merged).toBe(false);
    expect(store.cards().find((c) => c.id === '1')?.quantity).toBe(4);
    await vi.waitFor(() => expect(store.summary()?.copies).toBe(5));
  });

  it('removes the edited row when a condition change merges two Owned cards', async () => {
    const { store } = setup([
      ownedCard({ id: '1', condition: 'near_mint', quantity: 2 }),
      ownedCard({ id: '2', condition: 'damaged', quantity: 3 }),
    ]);
    await store.ensureLoaded();
    const damaged = store.cards().find((c) => c.id === '2')!;
    const result = await store.update(damaged, { condition: 'near_mint' });
    expect(result.merged).toBe(true);
    expect(store.cards().map((c) => [c.id, c.quantity])).toEqual([['1', 5]]);
  });

  it('removes a card from the list and the totals', async () => {
    const { store } = setup([
      ownedCard({ id: '1', quantity: 2 }),
      ownedCard({ id: '2', cardId: 'x', quantity: 3 }),
    ]);
    await store.ensureLoaded();
    await store.remove(store.cards().find((c) => c.id === '1')!);
    expect(store.cards().map((c) => c.id)).toEqual(['2']);
    await vi.waitFor(() => expect(store.summary()).toEqual({ entries: 1, copies: 3 }));
  });

  it('treats removing an already-removed card as done, but surfaces other errors', async () => {
    const { fake, store } = setup([ownedCard({ id: '1' })]);
    await store.ensureLoaded();
    const card = store.cards()[0];
    fake.removeImpl = async () => {
      throw new OwnedCardsError('not-found');
    };
    await store.remove(card);
    expect(store.cards()).toEqual([]);
    fake.removeImpl = async () => {
      throw new OwnedCardsError('network');
    };
    await expect(store.remove(card)).rejects.toMatchObject({ code: 'network' });
  });

  it('forgets everything on reset, including filters', async () => {
    const { store } = setup([ownedCard({ id: '1' })]);
    await store.ensureLoaded();
    await store.setText('x');
    store.reset();
    expect(store.cards()).toEqual([]);
    expect(store.status()).toBe('idle');
    expect(store.filtersActive()).toBe(false);
    expect(store.sort()).toBe('updated');
  });
});
