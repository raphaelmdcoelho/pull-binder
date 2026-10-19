/** Finishes a Card can exist in; an Owned card picks one of them. */
export type Finish = 'normal' | 'holo' | 'reverse_holo' | 'other';

/** A Card as listed in a search: enough for a grid cell. */
export interface CardSummary {
  id: string;
  /** Number inside its set, as printed (can be non-numeric, e.g. "SV042"). */
  number: string;
  name: string;
  /** Image base URL without size suffix, or null when the Catalog has no scan. */
  imageBase: string | null;
}

export interface Card extends CardSummary {
  setId: string;
  setName: string;
  rarity: string | null;
  illustrator: string | null;
  finishes: Finish[];
  /** Language of the data (a Card missing in the UI language falls back to English). */
  lang: string;
}

export interface CardPage {
  cards: CardSummary[];
  page: number;
  hasMore: boolean;
  /** Language the cards are in; may differ from the one asked for. */
  lang: string;
  fellBackToEnglish: boolean;
}

export interface SearchRequest {
  query: string;
  /** Catalog language code, see toCatalogLang. */
  lang: string;
  page: number;
}

export type ImageSize = 'low' | 'high';

export function cardImageUrl(card: Pick<CardSummary, 'imageBase'>, size: ImageSize): string | null {
  return card.imageBase ? `${card.imageBase}/${size}.webp` : null;
}
