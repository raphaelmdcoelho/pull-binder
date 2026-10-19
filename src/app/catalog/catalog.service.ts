import { AppLang } from '../core/i18n/languages';
import { Card, CardPage, SearchRequest } from './card.model';

export type CatalogErrorCode = 'network' | 'not-found' | 'unknown';

export class CatalogError extends Error {
  constructor(
    readonly code: CatalogErrorCode,
    options?: ErrorOptions,
  ) {
    super(`Catalog error: ${code}`, options);
    this.name = 'CatalogError';
  }
}

/** Catalog language codes are TCGdex's; the UI's pt-BR is "pt" there. */
export function toCatalogLang(lang: AppLang): string {
  return lang === 'pt-BR' ? 'pt' : lang;
}

/**
 * The Catalog port (ADR 0002). Features depend on this class only, never on a vendor SDK.
 * Both calls resolve in the requested language when the Catalog has it and fall back to English
 * otherwise; the result says which language it is in.
 */
export abstract class CatalogService {
  abstract searchCards(request: SearchRequest): Promise<CardPage>;
  abstract getCard(id: string, lang: string): Promise<Card>;
}
