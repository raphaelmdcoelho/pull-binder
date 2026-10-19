import { TestBed } from '@angular/core/testing';
import { FakeOwnedCards, provideFakeOwnedCards } from '../../testing/fake-owned-cards';
import { OwnedCardsError } from './owned-cards.repository';
import { CollectionStore } from './collection.store';

function setup() {
  const fake = new FakeOwnedCards();
  TestBed.configureTestingModule({ providers: [provideFakeOwnedCards(fake)] });
  return { fake, store: TestBed.inject(CollectionStore) };
}

const row = (id: string, quantity: number) =>
  ({
    id,
    quantity,
    cardId: id,
    cardName: id,
    language: 'en',
    condition: 'near_mint',
    finish: 'normal',
  }) as never;

describe('CollectionStore', () => {
  it('is empty after loading nothing', async () => {
    const { store } = setup();
    await store.ensureLoaded();
    expect(store.isEmpty()).toBe(true);
  });

  it('totals the copies', async () => {
    const { fake, store } = setup();
    fake.listImpl = async () => [row('a', 2), row('b', 3)];
    await store.ensureLoaded();
    expect(store.totalCopies()).toBe(5);
    expect(store.cards()).toHaveLength(2);
  });

  it('does not reload until marked stale', async () => {
    const { fake, store } = setup();
    let calls = 0;
    fake.listImpl = async () => (calls++, []);
    await store.ensureLoaded();
    await store.ensureLoaded();
    expect(calls).toBe(1);
    store.markStale();
    await store.ensureLoaded();
    expect(calls).toBe(2);
  });

  it('reports a load error and recovers on refresh', async () => {
    const { fake, store } = setup();
    fake.listImpl = async () => {
      throw new OwnedCardsError('network');
    };
    await store.ensureLoaded();
    expect(store.status()).toBe('error');
    expect(store.error()?.code).toBe('network');
    fake.listImpl = async () => [row('a', 1)];
    await store.refresh();
    expect(store.status()).toBe('loaded');
  });

  it('forgets everything on reset', async () => {
    const { fake, store } = setup();
    fake.listImpl = async () => [row('a', 1)];
    await store.ensureLoaded();
    store.reset();
    expect(store.cards()).toEqual([]);
    expect(store.status()).toBe('idle');
  });
});
