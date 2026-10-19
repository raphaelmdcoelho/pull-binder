import { AddOwnedCardInput, OwnedCard } from './owned-card.model';

export type OwnedCardsErrorCode = 'quantity-limit' | 'unauthenticated' | 'network' | 'unknown';

export class OwnedCardsError extends Error {
  constructor(
    readonly code: OwnedCardsErrorCode,
    options?: ErrorOptions,
  ) {
    super(`Owned cards error: ${code}`, options);
    this.name = 'OwnedCardsError';
  }
}

/** Storage port for the signed-in user's Collection. */
export abstract class OwnedCardsRepository {
  /**
   * Adds copies. If an Owned card with the same card, Language, Condition and Finish exists, its
   * quantity grows by `quantity` instead of creating a second row.
   */
  abstract add(input: AddOwnedCardInput): Promise<OwnedCard>;
  abstract list(): Promise<OwnedCard[]>;
}
