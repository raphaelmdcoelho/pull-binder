import { Provider } from '@angular/core';
import {
  AddOwnedCardInput,
  CollectionPage,
  CollectionQuery,
  CollectionSummary,
  OwnedCard,
  OwnedCardUpdate,
  SetOption,
  UpdateResult,
} from '../app/collection/owned-card.model';
import { OwnedCardsError, OwnedCardsRepository } from '../app/collection/owned-cards.repository';

export function ownedCard(over: Partial<OwnedCard> = {}): OwnedCard {
  return {
    id: 'row-x',
    cardId: 'base1-4',
    language: 'en',
    condition: 'near_mint',
    finish: 'holo',
    quantity: 1,
    cardName: 'Charizard',
    cardNumber: '4',
    setId: 'base1',
    setName: 'Base Set',
    imageBase: 'https://img.test/base1-4',
    updatedAt: '2026-10-19T00:00:00.000Z',
    ...over,
  };
}

function matches(card: OwnedCard, q: CollectionQuery): boolean {
  const text = q.text.trim().toLowerCase();
  return (
    (!text || card.cardName.toLowerCase().includes(text)) &&
    (!q.setId || card.setId === q.setId) &&
    (!q.condition || card.condition === q.condition) &&
    (!q.language || card.language === q.language) &&
    (!q.finish || card.finish === q.finish)
  );
}

function compare(q: CollectionQuery) {
  return (a: OwnedCard, b: OwnedCard): number => {
    switch (q.sort) {
      case 'name':
        return a.cardName.localeCompare(b.cardName);
      case 'set':
        return a.setName.localeCompare(b.setName) || a.cardName.localeCompare(b.cardName);
      case 'quantity':
        return b.quantity - a.quantity || a.cardName.localeCompare(b.cardName);
      default:
        return b.updatedAt.localeCompare(a.updatedAt);
    }
  };
}

/** In-memory Collection that filters, sorts, pages and merges like the real one. */
export class FakeOwnedCards extends OwnedCardsRepository {
  rows: OwnedCard[] = [];
  addImpl: ((input: AddOwnedCardInput) => Promise<OwnedCard>) | null = null;
  listImpl:
    | ((q: CollectionQuery, page: { offset: number; limit: number }) => Promise<CollectionPage>)
    | null = null;
  updateImpl: ((id: string, patch: OwnedCardUpdate) => Promise<UpdateResult>) | null = null;
  removeImpl: ((id: string) => Promise<void>) | null = null;
  readonly added: AddOwnedCardInput[] = [];
  readonly listCalls: { query: CollectionQuery; offset: number; limit: number }[] = [];
  private seq = 0;

  override async add(input: AddOwnedCardInput): Promise<OwnedCard> {
    this.added.push(input);
    if (this.addImpl) return this.addImpl(input);
    const { card } = input;
    const existing = this.rows.find(
      (r) =>
        r.cardId === card.id &&
        r.language === input.language &&
        r.condition === input.condition &&
        r.finish === input.finish,
    );
    if (existing) {
      existing.quantity += input.quantity;
      return existing;
    }
    const row = ownedCard({
      id: `row-${++this.seq}`,
      cardId: card.id,
      language: input.language,
      condition: input.condition,
      finish: input.finish,
      quantity: input.quantity,
      cardName: card.name,
      cardNumber: card.number,
      setId: card.setId,
      setName: card.setName,
      imageBase: card.imageBase,
      updatedAt: new Date(Date.now() + this.seq).toISOString(),
    });
    this.rows.unshift(row);
    return row;
  }

  override async list(
    query: CollectionQuery,
    page: { offset: number; limit: number },
  ): Promise<CollectionPage> {
    this.listCalls.push({ query, ...page });
    if (this.listImpl) return this.listImpl(query, page);
    return this.defaultList(query, page);
  }

  /** The real behaviour, for tests that wrap `listImpl` (e.g. to delay it). */
  defaultList(query: CollectionQuery, page: { offset: number; limit: number }): CollectionPage {
    const all = this.rows.filter((r) => matches(r, query)).sort(compare(query));
    return {
      items: structuredClone(all.slice(page.offset, page.offset + page.limit)),
      hasMore: all.length > page.offset + page.limit,
    };
  }

  override async summarize(query: CollectionQuery): Promise<CollectionSummary> {
    const hit = this.rows.filter((r) => matches(r, query));
    return { entries: hit.length, copies: hit.reduce((sum, r) => sum + r.quantity, 0) };
  }

  override async listSets(): Promise<SetOption[]> {
    const sets = new Map(this.rows.map((r) => [r.setId, r.setName]));
    return [...sets]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  override async update(id: string, patch: OwnedCardUpdate): Promise<UpdateResult> {
    if (this.updateImpl) return this.updateImpl(id, patch);
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new OwnedCardsError('not-found');
    const quantity = patch.quantity ?? row.quantity;
    const target = patch.condition
      ? this.rows.find(
          (r) =>
            r.id !== id &&
            r.cardId === row.cardId &&
            r.language === row.language &&
            r.finish === row.finish &&
            r.condition === patch.condition,
        )
      : undefined;
    if (target) {
      target.quantity += quantity;
      this.rows = this.rows.filter((r) => r.id !== id);
      return { card: structuredClone(target), merged: true };
    }
    row.quantity = quantity;
    if (patch.condition) row.condition = patch.condition;
    return { card: structuredClone(row), merged: false };
  }

  override async remove(id: string): Promise<void> {
    if (this.removeImpl) return this.removeImpl(id);
    if (!this.rows.some((r) => r.id === id)) throw new OwnedCardsError('not-found');
    this.rows = this.rows.filter((r) => r.id !== id);
  }
}

export function provideFakeOwnedCards(fake: FakeOwnedCards): Provider {
  return { provide: OwnedCardsRepository, useValue: fake };
}
