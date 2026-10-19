import { ownedCard } from '../../testing/fake-owned-cards';
import { applyCollectionQuery, summarizeCards } from './collection-query';
import { NO_FILTERS } from './owned-card.model';

const cards = [
  ownedCard({
    id: '1',
    cardName: 'Charizard',
    setId: 'base1',
    setName: 'Base Set',
    quantity: 1,
    updatedAt: '2026-01-03',
  }),
  ownedCard({
    id: '2',
    cardName: 'Pikachu',
    setId: 'jungle',
    setName: 'Jungle',
    quantity: 4,
    condition: 'damaged',
    updatedAt: '2026-01-02',
  }),
  ownedCard({
    id: '3',
    cardName: 'Charmander',
    setId: 'base1',
    setName: 'Base Set',
    quantity: 2,
    language: 'pt',
    finish: 'normal',
    updatedAt: '2026-01-01',
  }),
];
const q = (over = {}) => ({ ...NO_FILTERS, sort: 'updated' as const, ...over });
const ids = (list: { id: string }[]) => list.map((c) => c.id);

describe('applyCollectionQuery', () => {
  it('sorts by recently updated by default, without changing the input', () => {
    expect(ids(applyCollectionQuery(cards, q()))).toEqual(['1', '2', '3']);
    expect(ids(cards)).toEqual(['1', '2', '3']);
  });

  it('sorts by name, set and quantity', () => {
    expect(ids(applyCollectionQuery(cards, q({ sort: 'name' })))).toEqual(['1', '3', '2']);
    expect(ids(applyCollectionQuery(cards, q({ sort: 'set' })))).toEqual(['1', '3', '2']);
    expect(ids(applyCollectionQuery(cards, q({ sort: 'quantity' })))).toEqual(['2', '3', '1']);
  });

  it('matches the name case-insensitively as "contains"', () => {
    expect(ids(applyCollectionQuery(cards, q({ text: ' CHAR ' })))).toEqual(['1', '3']);
  });

  it('combines the exact filters', () => {
    expect(ids(applyCollectionQuery(cards, q({ setId: 'base1', language: 'pt' })))).toEqual(['3']);
    expect(ids(applyCollectionQuery(cards, q({ condition: 'damaged' })))).toEqual(['2']);
    expect(ids(applyCollectionQuery(cards, q({ finish: 'normal' })))).toEqual(['3']);
  });

  it('summarises entries and copies', () => {
    expect(summarizeCards(cards)).toEqual({ entries: 3, copies: 7 });
  });
});
