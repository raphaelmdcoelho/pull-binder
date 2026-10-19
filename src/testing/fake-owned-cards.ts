import { Provider } from '@angular/core';
import { AddOwnedCardInput, OwnedCard } from '../app/collection/owned-card.model';
import { OwnedCardsRepository } from '../app/collection/owned-cards.repository';

/** In-memory Collection that merges like the real one: same key adds to the quantity. */
export class FakeOwnedCards extends OwnedCardsRepository {
  rows: OwnedCard[] = [];
  addImpl: ((input: AddOwnedCardInput) => Promise<OwnedCard>) | null = null;
  listImpl: (() => Promise<OwnedCard[]>) | null = null;
  readonly added: AddOwnedCardInput[] = [];

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
    const row: OwnedCard = {
      id: `row-${this.rows.length + 1}`,
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
      updatedAt: new Date().toISOString(),
    };
    this.rows.unshift(row);
    return row;
  }

  override async list(): Promise<OwnedCard[]> {
    return this.listImpl ? this.listImpl() : structuredClone(this.rows);
  }
}

export function provideFakeOwnedCards(fake: FakeOwnedCards): Provider {
  return { provide: OwnedCardsRepository, useValue: fake };
}
