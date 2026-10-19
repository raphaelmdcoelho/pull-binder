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

  const everything = {
    text: '',
    setId: null,
    condition: null,
    language: null,
    finish: null,
    sort: 'updated',
  } as const;

  async function seed(repo: OwnedCardsRepository) {
    await repo.add(
      input({
        card: { ...card, id: 'a-1', name: 'Pikachu', setId: 'a', setName: 'Alpha' },
        quantity: 3,
      }),
    );
    await repo.add(
      input({
        card: { ...card, id: 'b-1', name: 'Charizard', setId: 'b', setName: 'Beta' },
        condition: 'damaged',
        quantity: 1,
      }),
    );
    await repo.add(
      input({
        card: { ...card, id: 'a-2', name: '100%_Pichu', setId: 'a', setName: 'Alpha' },
        language: 'ja',
        finish: 'normal',
        quantity: 2,
      }),
    );
  }

  it('lists a page with hasMore from the extra row', async () => {
    const { repo } = setup();
    await seed(repo);
    const first = await repo.list(everything, { offset: 0, limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    const second = await repo.list(everything, { offset: 2, limit: 2 });
    expect(second.items).toHaveLength(1);
    expect(second.hasMore).toBe(false);
  });

  it('filters by name (case-insensitive, wildcards escaped), set, condition, language and finish', async () => {
    const { repo } = setup();
    await seed(repo);
    const names = async (over: object) =>
      (await repo.list({ ...everything, ...over }, { offset: 0, limit: 10 })).items
        .map((i) => i.cardName)
        .sort();
    expect(await names({ text: 'PIK' })).toEqual(['Pikachu']);
    expect(await names({ text: 'pi' })).toEqual(['100%_Pichu', 'Pikachu']);
    expect(await names({ text: '%' })).toEqual(['100%_Pichu']);
    expect(await names({ text: '_' })).toEqual(['100%_Pichu']);
    expect(await names({ setId: 'a' })).toEqual(['100%_Pichu', 'Pikachu']);
    expect(await names({ condition: 'damaged' })).toEqual(['Charizard']);
    expect(await names({ language: 'ja' })).toEqual(['100%_Pichu']);
    expect(await names({ finish: 'normal' })).toEqual(['100%_Pichu']);
    expect(await names({ setId: 'a', language: 'en' })).toEqual(['Pikachu']);
  });

  it('sorts by name, set, quantity and recently updated', async () => {
    const { table, repo } = setup();
    await seed(repo);
    const order = async (sort: 'updated' | 'name' | 'set' | 'quantity') =>
      (await repo.list({ ...everything, sort }, { offset: 0, limit: 10 })).items.map(
        (i) => i.cardName,
      );
    expect(await order('name')).toEqual(['100%_Pichu', 'Charizard', 'Pikachu']);
    expect(await order('quantity')).toEqual(['Pikachu', '100%_Pichu', 'Charizard']);
    expect((await order('set'))[2]).toBe('Charizard');
    table.rows[0]['updated_at'] = '2020-01-01T00:00:00Z';
    expect((await order('updated')).at(-1)).toBe('Pikachu');
  });

  it('summarises all matches: distinct entries and total copies', async () => {
    const { repo } = setup();
    await seed(repo);
    expect(await repo.summarize(everything)).toEqual({ entries: 3, copies: 6 });
    expect(await repo.summarize({ ...everything, setId: 'a' })).toEqual({ entries: 2, copies: 5 });
  });

  it('lists each owned set once, sorted by name', async () => {
    const { repo } = setup();
    await seed(repo);
    expect(await repo.listSets()).toEqual([
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Beta' },
    ]);
  });

  it('updates quantity and condition', async () => {
    const { repo } = setup();
    const owned = await repo.add(input({ quantity: 2 }));
    const result = await repo.update(owned.id, { quantity: 7, condition: 'heavily_played' });
    expect(result.merged).toBe(false);
    expect(result.card).toMatchObject({ quantity: 7, condition: 'heavily_played' });
  });

  it('rejects out-of-range quantities and unknown ids', async () => {
    const { repo } = setup();
    const owned = await repo.add(input());
    await expect(repo.update(owned.id, { quantity: 0 })).rejects.toMatchObject({
      code: 'quantity-limit',
    });
    await expect(repo.update(owned.id, { quantity: 10000 })).rejects.toMatchObject({
      code: 'quantity-limit',
    });
    await expect(repo.update('nope', { quantity: 2 })).rejects.toMatchObject({ code: 'not-found' });
  });

  it('merges into the existing Owned card when the new condition already exists', async () => {
    const { table, repo } = setup();
    const nm = await repo.add(input({ quantity: 2 }));
    const damaged = await repo.add(input({ condition: 'damaged', quantity: 3 }));
    const result = await repo.update(damaged.id, { condition: 'near_mint' });
    expect(result.merged).toBe(true);
    expect(result.card).toMatchObject({ id: nm.id, quantity: 5 });
    expect(table.rows).toHaveLength(1);
  });

  it('merges using the edited quantity, not the old one', async () => {
    const { table, repo } = setup();
    await repo.add(input({ quantity: 2 }));
    const damaged = await repo.add(input({ condition: 'damaged', quantity: 3 }));
    const result = await repo.update(damaged.id, { condition: 'near_mint', quantity: 1 });
    expect(result.card.quantity).toBe(3);
    expect(table.rows).toHaveLength(1);
  });

  it('refuses a merge that would pass 9999 and changes nothing', async () => {
    const { table, repo } = setup();
    await repo.add(input({ quantity: 9999 }));
    const damaged = await repo.add(input({ condition: 'damaged', quantity: 1 }));
    await expect(repo.update(damaged.id, { condition: 'near_mint' })).rejects.toMatchObject({
      code: 'quantity-limit',
    });
    expect(table.rows.map((r) => r['quantity'])).toEqual([9999, 1]);
  });

  it('removes a row and reports a missing one', async () => {
    const { table, repo } = setup();
    const owned = await repo.add(input());
    await repo.remove(owned.id);
    expect(table.rows).toHaveLength(0);
    await expect(repo.remove(owned.id)).rejects.toMatchObject({ code: 'not-found' });
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
