import {
  AddOwnedCardInput,
  CollectionPage,
  CollectionQuery,
  CollectionSummary,
  OwnedCard,
  OwnedCardUpdate,
  SetOption,
  UpdateResult,
} from './owned-card.model';

export type OwnedCardsErrorCode =
  'quantity-limit' | 'not-found' | 'unauthenticated' | 'network' | 'offline' | 'unknown';

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
  /** One page of the Collection, filtered and sorted by the server. */
  abstract list(
    query: CollectionQuery,
    page: { offset: number; limit: number },
  ): Promise<CollectionPage>;
  /** Counts for everything matching the query, not just the loaded page. */
  abstract summarize(query: CollectionQuery): Promise<CollectionSummary>;
  /** Every set the user owns a card from, for the set filter. */
  abstract listSets(): Promise<SetOption[]>;
  /**
   * Changes quantity and/or Condition. A Condition that matches another Owned card of the same
   * card, Language and Finish merges the two (the copies are added together).
   */
  abstract update(id: string, patch: OwnedCardUpdate): Promise<UpdateResult>;
  abstract remove(id: string): Promise<void>;
}
