import { Card, Finish } from '../catalog/card.model';

export const CONDITIONS = [
  'near_mint',
  'lightly_played',
  'moderately_played',
  'heavily_played',
  'damaged',
] as const;
export type Condition = (typeof CONDITIONS)[number];

/** Printed Languages an Owned card can have (TCGdex codes, lowercase). */
export const CARD_LANGUAGES = [
  'en',
  'pt',
  'es',
  'fr',
  'de',
  'it',
  'nl',
  'pl',
  'ru',
  'ja',
  'ko',
  'zh-tw',
  'zh-cn',
  'id',
  'th',
] as const;
export type CardLanguage = (typeof CARD_LANGUAGES)[number];

export const MAX_QUANTITY = 9999;

export function isCardLanguage(value: string): value is CardLanguage {
  return (CARD_LANGUAGES as readonly string[]).includes(value);
}

/** One Owned card: identical copies merged, with a quantity. */
export interface OwnedCard {
  id: string;
  cardId: string;
  language: CardLanguage;
  condition: Condition;
  finish: Finish;
  quantity: number;
  /** Snapshot of Catalog data, kept so the Collection can be shown without the Catalog (ADR 0003). */
  cardName: string;
  cardNumber: string | null;
  setId: string;
  setName: string;
  /** Catalog image base URL (no size suffix), or null. */
  imageBase: string | null;
  updatedAt: string;
}

export interface AddOwnedCardInput {
  card: Card;
  language: CardLanguage;
  condition: Condition;
  finish: Finish;
  quantity: number;
}

export type CollectionSort = 'updated' | 'name' | 'set' | 'quantity';
export const COLLECTION_SORTS: readonly CollectionSort[] = ['updated', 'name', 'set', 'quantity'];

/** What the user narrows the Collection by. `null` means "any". */
export interface CollectionFilters {
  text: string;
  setId: string | null;
  condition: Condition | null;
  language: CardLanguage | null;
  finish: Finish | null;
}

export interface CollectionQuery extends CollectionFilters {
  sort: CollectionSort;
}

export const NO_FILTERS: CollectionFilters = {
  text: '',
  setId: null,
  condition: null,
  language: null,
  finish: null,
};

export function hasActiveFilters(filters: CollectionFilters): boolean {
  return (
    filters.text.trim() !== '' ||
    filters.setId !== null ||
    filters.condition !== null ||
    filters.language !== null ||
    filters.finish !== null
  );
}

export function activeFilterCount(filters: CollectionFilters): number {
  return [filters.setId, filters.condition, filters.language, filters.finish].filter(
    (v) => v !== null,
  ).length;
}

export interface CollectionPage {
  items: OwnedCard[];
  hasMore: boolean;
}

/** Distinct Owned cards (rows) and total copies (sum of quantities). */
export interface CollectionSummary {
  entries: number;
  copies: number;
}

export interface SetOption {
  id: string;
  name: string;
}

export interface OwnedCardUpdate {
  quantity?: number;
  condition?: Condition;
}

export interface UpdateResult {
  /** The Owned card as it is now; after a merge, the one the copies were added to. */
  card: OwnedCard;
  /** True when the new Condition matched another Owned card and the two were combined. */
  merged: boolean;
}
