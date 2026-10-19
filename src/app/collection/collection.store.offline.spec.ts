import { TestBed } from '@angular/core/testing';
import { AuthService } from '../core/auth/auth.service';
import { FakeOwnedCards, ownedCard, provideFakeOwnedCards } from '../../testing/fake-owned-cards';
import {
  FakeConnectivity,
  MemorySnapshotStorage,
  provideFakeConnectivity,
  provideMemorySnapshots,
} from '../../testing/fake-pwa';
import {
  TEST_USER,
  createFakeSupabase,
  provideFakeSupabase,
  sessionFor,
} from '../../testing/fake-supabase';
import { CollectionSnapshots } from './collection-snapshot';
import { CollectionStore } from './collection.store';
import { OwnedCardsError } from './owned-cards.repository';

const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

const rows = () => [
  ownedCard({ id: 'a', cardName: 'Charizard', quantity: 1, updatedAt: '2026-01-03' }),
  ownedCard({
    id: 'b',
    cardName: 'Pikachu',
    setId: 'jungle',
    setName: 'Jungle',
    quantity: 3,
    updatedAt: '2026-01-02',
  }),
];

async function setup(user: 'user-1' | 'user-2' | null = 'user-1') {
  const fake = new FakeOwnedCards();
  fake.rows = rows();
  const connectivity = new FakeConnectivity();
  const storage = new MemorySnapshotStorage();
  const supabase = createFakeSupabase(
    user ? sessionFor({ ...TEST_USER, id: user } as typeof TEST_USER) : null,
  );
  TestBed.configureTestingModule({
    providers: [
      provideFakeOwnedCards(fake),
      provideFakeConnectivity(connectivity),
      provideMemorySnapshots(storage),
      provideFakeSupabase(supabase),
    ],
  });
  await TestBed.inject(AuthService).init();
  return { fake, connectivity, storage, supabase, store: TestBed.inject(CollectionStore) };
}

/** Loads online once, as a returning user would, then goes offline with a fresh store. */
async function savedThenOffline() {
  const first = await setup();
  await first.store.ensureLoaded();
  await settle();
  first.store.reset();
  first.connectivity.set(false);
  return first;
}

describe('CollectionStore offline', () => {
  it('saves the unfiltered view after an online load', async () => {
    const { storage, store } = await setup();
    await store.ensureLoaded();
    await settle();
    const saved = (await TestBed.inject(CollectionSnapshots).load('user-1'))!;
    expect(saved.cards.map((c) => c.id)).toEqual(['a', 'b']);
    expect(saved.summary).toEqual({ entries: 2, copies: 4 });
    expect(saved.sets.map((s) => s.id)).toEqual(['base1', 'jungle']);
    expect(storage.data.size).toBe(1);
  });

  it('does not overwrite the saved view with a filtered or re-sorted one', async () => {
    const { store } = await setup();
    await store.ensureLoaded();
    await settle();
    await store.setText('pika');
    await store.setSort('name');
    await settle();
    const saved = (await TestBed.inject(CollectionSnapshots).load('user-1'))!;
    expect(saved.cards).toHaveLength(2);
  });

  it('shows the saved Collection when it opens offline, marked as a saved copy', async () => {
    const { fake, store } = await savedThenOffline();
    fake.listCalls.length = 0;
    await store.ensureLoaded();
    expect(fake.listCalls).toHaveLength(0);
    expect(store.status()).toBe('loaded');
    expect(store.cards().map((c) => c.id)).toEqual(['a', 'b']);
    expect(store.cachedAt()).toBeGreaterThan(0);
    expect(store.hasMore()).toBe(false);
    expect(store.summary()).toEqual({ entries: 2, copies: 4 });
    expect(store.sets()).toHaveLength(2);
  });

  it('filters and sorts the saved copy on the device', async () => {
    const { store } = await savedThenOffline();
    await store.ensureLoaded();
    await store.setText('pika');
    expect(store.cards().map((c) => c.id)).toEqual(['b']);
    expect(store.summary()).toEqual({ entries: 1, copies: 3 });
    await store.clearFilters();
    await store.setSort('quantity');
    expect(store.cards().map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('flags a saved copy that holds only the loaded pages', async () => {
    const first = await setup();
    first.fake.rows = Array.from({ length: 35 }, (_, i) =>
      ownedCard({
        id: `r${i}`,
        cardId: `c${i}`,
        updatedAt: `2026-01-${String(i + 1).padStart(2, '0')}`,
      }),
    );
    await first.store.ensureLoaded();
    await settle();
    first.store.reset();
    first.connectivity.set(false);
    await first.store.ensureLoaded();
    expect(first.store.cards()).toHaveLength(30);
    expect(first.store.cachedPartial()).toBe(true);
  });

  it('explains when offline with nothing saved yet', async () => {
    const { store, connectivity } = await setup();
    connectivity.set(false);
    await store.ensureLoaded();
    expect(store.status()).toBe('error');
    expect(store.error()?.code).toBe('offline');
  });

  it('falls back to the saved copy when the network call fails while "online"', async () => {
    const { fake, store } = await setup();
    await store.ensureLoaded();
    await settle();
    fake.listImpl = async () => {
      throw new OwnedCardsError('network');
    };
    await store.reload();
    expect(store.status()).toBe('loaded');
    expect(store.cachedAt()).not.toBeNull();
    expect(store.cards()).toHaveLength(2);
  });

  it('keeps reporting other errors instead of hiding them behind the saved copy', async () => {
    const { fake, store } = await setup();
    await store.ensureLoaded();
    await settle();
    fake.listImpl = async () => {
      throw new OwnedCardsError('unknown');
    };
    await store.reload();
    expect(store.status()).toBe('error');
  });

  it('reloads the live Collection when the connection returns', async () => {
    const { fake, connectivity, store } = await savedThenOffline();
    await store.ensureLoaded();
    TestBed.tick();
    fake.rows.push(ownedCard({ id: 'c', cardName: 'Mew', updatedAt: '2026-02-01' }));
    connectivity.set(true);
    TestBed.tick();
    await settle();
    expect(store.cachedAt()).toBeNull();
    expect(store.cards().map((c) => c.id)).toEqual(['c', 'a', 'b']);
  });

  it('refuses writes while offline without touching the server', async () => {
    const { fake, connectivity, store } = await setup();
    await store.ensureLoaded();
    connectivity.set(false);
    const card = store.cards()[0];
    await expect(store.update(card, { quantity: 2 })).rejects.toMatchObject({ code: 'offline' });
    await expect(store.remove(card)).rejects.toMatchObject({ code: 'offline' });
    expect(fake.rows).toHaveLength(2);
    expect(fake.rows[0].quantity).toBe(1);
  });

  it('updates the saved copy after an edit or removal', async () => {
    const { store } = await setup();
    await store.ensureLoaded();
    await store.update(store.cards()[0], { quantity: 5 });
    await settle();
    let saved = (await TestBed.inject(CollectionSnapshots).load('user-1'))!;
    expect(saved.cards.find((c) => c.id === 'a')?.quantity).toBe(5);
    expect(saved.summary).toEqual({ entries: 2, copies: 8 });
    await store.remove(store.cards()[0]);
    await settle();
    saved = (await TestBed.inject(CollectionSnapshots).load('user-1'))!;
    expect(saved.cards.map((c) => c.id)).toEqual(['b']);
  });

  it('rebuilds the saved copy after an edit made while the view is filtered', async () => {
    const { store } = await setup();
    await store.ensureLoaded();
    await store.setText('pika');
    await store.update(store.cards()[0], { quantity: 9 });
    await settle();
    const saved = (await TestBed.inject(CollectionSnapshots).load('user-1'))!;
    expect(saved.cards).toHaveLength(2);
    expect(saved.cards.find((c) => c.id === 'b')?.quantity).toBe(9);
  });

  it('refreshes the saved copy after an add', async () => {
    const { fake, store } = await setup();
    await store.ensureLoaded();
    fake.rows.unshift(ownedCard({ id: 'z', cardName: 'Zubat', updatedAt: '2026-03-01' }));
    store.markStale();
    await settle();
    const saved = (await TestBed.inject(CollectionSnapshots).load('user-1'))!;
    expect(saved.cards[0].id).toBe('z');
  });

  it('removes the saved copy and the list when the user signs out', async () => {
    const { supabase, storage, store } = await setup();
    await store.ensureLoaded();
    await settle();
    expect(storage.data.size).toBe(1);
    supabase.emit('SIGNED_OUT', null);
    TestBed.tick();
    await settle();
    expect(storage.data.size).toBe(0);
    expect(store.cards()).toEqual([]);
    expect(store.status()).toBe('idle');
  });

  it('never shows one user the saved copy of another', async () => {
    const { supabase, connectivity, store } = await setup('user-1');
    await store.ensureLoaded();
    await settle();
    // Another account signs in on the same device without a clean sign-out first.
    supabase.emit('SIGNED_IN', sessionFor({ ...TEST_USER, id: 'user-2' } as typeof TEST_USER));
    TestBed.tick();
    connectivity.set(false);
    await store.ensureLoaded();
    expect(store.status()).toBe('error');
    expect(store.cards()).toEqual([]);
  });
});
