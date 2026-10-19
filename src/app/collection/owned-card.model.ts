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
