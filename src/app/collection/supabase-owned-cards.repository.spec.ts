import { PostgrestError } from '@supabase/supabase-js';
import { TestBed } from '@angular/core/testing';
import { Card } from '../catalog/card.model';
import { FakeOwnedTable, provideFakeOwnedTable } from '../../testing/fake-owned-table';
import { AddOwnedCardInput } from './owned-card.model';
import { OwnedCardsRepository } from './owned-cards.repository';
import { SupabaseOwnedCardsRepository, toError } from './supabase-owned-cards.repository';

const card: Card = {
  id: 'base1-4',
  number: '4',
  name: 'Charizard',
  imageBase: 'https://img.test/base1-4',
  setId: 'base1',
  setName: 'Base Set',
  rarity: 'Rare',
  illustrator: null,
  finishes: ['holo'],
  lang: 'en',
};

const input = (over: Partial<AddOwnedCardInput> = {}): AddOwnedCardInput => ({
  card,
  language: 'en',
  condition: 'near_mint',
  finish: 'holo',
  quantity: 1,
  ...over,
});

const pgError = (code: string, message: string) =>
  new PostgrestError({ message, details: '', hint: '', code });

function setup() {
  const table = new FakeOwnedTable();
  TestBed.configureTestingModule({
    providers: [
      provideFakeOwnedTable(table),
      { provide: OwnedCardsRepository, useClass: SupabaseOwnedCardsRepository },
    ],
  });
  return { table, repo: TestBed.inject(OwnedCardsRepository) };
}

describe('SupabaseOwnedCardsRepository', () => {
  it('inserts a new Owned card with the Catalog snapshot', async () => {
    const { table, repo } = setup();
    const owned = await repo.add(input({ quantity: 2 }));
    expect(owned).toMatchObject({
      cardId: 'base1-4',
      quantity: 2,
      cardName: 'Charizard',
      cardNumber: '4',
      setId: 'base1',
      setName: 'Base Set',
      imageBase: 'https://img.test/base1-4',
    });
    expect(table.rows).toHaveLength(1);
  });

  it('adds to the quantity when the same card, language, condition and finish exists', async () => {
    const { table, repo } = setup();
    await repo.add(input({ quantity: 2 }));
    const merged = await repo.add(input({ quantity: 3 }));
    expect(merged.quantity).toBe(5);
    expect(table.rows).toHaveLength(1);
  });

  it('keeps a copy that differs as its own Owned card', async () => {
    const { table, repo } = setup();
    await repo.add(input());
    await repo.add(input({ condition: 'damaged' }));
    await repo.add(input({ language: 'pt' }));
    await repo.add(input({ finish: 'normal' }));
    expect(table.rows).toHaveLength(4);
  });

  it('refreshes the snapshot when merging', async () => {
    const { table, repo } = setup();
    await repo.add(input());
    await repo.add(input({ card: { ...card, setName: 'Base Set (renamed)' } }));
    expect(table.rows[0]['set_name']).toBe('Base Set (renamed)');
  });

  it('retries when the quantity changed between read and update', async () => {
    const { table, repo } = setup();
    await repo.add(input({ quantity: 1 }));
    // Another tab adds 5 right before our update lands: our first compare-and-swap must fail.
    table.beforeUpdate = () => (table.rows[0]['quantity'] = 6);
    const merged = await repo.add(input({ quantity: 1 }));
    expect(merged.quantity).toBe(7);
  });

  it('refuses to go past 9999 copies', async () => {
    const { repo } = setup();
    await repo.add(input({ quantity: 9999 }));
    await expect(repo.add(input({ quantity: 1 }))).rejects.toMatchObject({
      code: 'quantity-limit',
    });
  });

  it('re-inserts if the row vanished during the merge', async () => {
    const { table, repo } = setup();
    await repo.add(input());
    // First lookup finds it, but it is deleted before we can update: handled by starting over.
    const original = table.rows[0];
    table.beforeUpdate = () => table.rows.splice(0, 1);
    const result = await repo.add(input({ quantity: 2 }));
    expect(result.quantity).toBe(2);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]).not.toBe(original);
  });

  it('lists newest first', async () => {
    const { table, repo } = setup();
    await repo.add(input());
    await repo.add(input({ condition: 'damaged' }));
    table.rows[0]['updated_at'] = '2020-01-01T00:00:00Z';
    const list = await repo.list();
    expect(list.map((o) => o.condition)).toEqual(['damaged', 'near_mint']);
  });

  it('maps database errors to typed errors', async () => {
    const { table, repo } = setup();
    table.failWith = { code: '42501', message: 'rls' };
    await expect(repo.add(input())).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(toError(pgError('', 'TypeError: Failed to fetch')).code).toBe('network');
    expect(toError(pgError('23514', 'x')).code).toBe('quantity-limit');
    expect(toError(pgError('XX000', 'x')).code).toBe('unknown');
  });
});
