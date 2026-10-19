import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { TimeoutError, firstValueFrom, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Card, CardPage, CardSummary, Finish, SearchRequest } from '../card.model';
import { CatalogCache } from '../catalog.cache';
import { CatalogError, CatalogService } from '../catalog.service';

export const PAGE_SIZE = 20;
const REQUEST_TIMEOUT_MS = 10_000;
const SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
const CARD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface TcgdexBrief {
  id: string;
  localId: string;
  name: string;
  image?: string;
}

interface TcgdexCard extends TcgdexBrief {
  rarity?: string;
  illustrator?: string;
  set?: { id: string; name: string };
  variants?: Partial<Record<'normal' | 'reverse' | 'holo' | 'firstEdition' | 'wPromo', boolean>>;
}

/** The only code that knows TCGdex URLs and field names. */
@Injectable()
export class TcgdexCatalogService extends CatalogService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(CatalogCache);

  async searchCards({ query, lang, page }: SearchRequest): Promise<CardPage> {
    const key = `search:${lang}:${page}:${query.trim().toLowerCase()}`;
    const cached = await this.cache.get<CardPage>(key, SEARCH_TTL_MS);
    if (cached?.fresh) return cached.value;

    try {
      let result = await this.fetchPage(query, lang, page);
      // Only a first page that is empty falls back; later pages keep the language already in use.
      if (result.cards.length === 0 && page === 1 && lang !== 'en') {
        result = { ...(await this.fetchPage(query, 'en', 1)), fellBackToEnglish: true };
      }
      await this.cache.put(key, result);
      return result;
    } catch (error) {
      if (cached) return cached.value; // stale beats nothing when offline
      throw toCatalogError(error);
    }
  }

  async getCard(id: string, lang: string): Promise<Card> {
    const key = `card:${lang}:${id}`;
    const cached = await this.cache.get<Card>(key, CARD_TTL_MS);
    if (cached?.fresh) return cached.value;

    try {
      let card: Card;
      try {
        card = await this.fetchCard(id, lang);
      } catch (error) {
        if (lang === 'en' || toCatalogError(error).code !== 'not-found') throw error;
        card = await this.fetchCard(id, 'en');
      }
      await this.cache.put(key, card);
      return card;
    } catch (error) {
      if (cached) return cached.value;
      throw toCatalogError(error);
    }
  }

  private async fetchPage(query: string, lang: string, page: number): Promise<CardPage> {
    const params = new HttpParams()
      .set('name', query.trim())
      .set('pagination:page', page)
      .set('pagination:itemsPerPage', PAGE_SIZE);
    const items = await this.get<TcgdexBrief[]>(`${lang}/cards`, params);
    return {
      cards: items.map(toSummary),
      page,
      // TCGdex returns no total, so a full page is the only hint that there may be more.
      hasMore: items.length === PAGE_SIZE,
      lang,
      fellBackToEnglish: false,
    };
  }

  private async fetchCard(id: string, lang: string): Promise<Card> {
    const raw = await this.get<TcgdexCard>(`${lang}/cards/${encodeURIComponent(id)}`);
    return {
      ...toSummary(raw),
      setId: raw.set?.id ?? '',
      setName: raw.set?.name ?? '',
      rarity: raw.rarity ?? null,
      illustrator: raw.illustrator ?? null,
      finishes: toFinishes(raw.variants),
      lang,
    };
  }

  private get<T>(path: string, params?: HttpParams): Promise<T> {
    return firstValueFrom(
      this.http
        .get<T>(`${environment.catalogApiUrl}/${path}`, { params })
        .pipe(timeout(REQUEST_TIMEOUT_MS)),
    );
  }
}

function toSummary(raw: TcgdexBrief): CardSummary {
  return { id: raw.id, number: raw.localId, name: raw.name, imageBase: raw.image ?? null };
}

export function toFinishes(variants: TcgdexCard['variants']): Finish[] {
  const finishes: Finish[] = [];
  if (variants?.normal) finishes.push('normal');
  if (variants?.holo) finishes.push('holo');
  if (variants?.reverse) finishes.push('reverse_holo');
  if (variants?.firstEdition || variants?.wPromo) finishes.push('other');
  return finishes.length ? finishes : ['normal'];
}

export function toCatalogError(error: unknown): CatalogError {
  if (error instanceof CatalogError) return error;
  if (error instanceof TimeoutError) return new CatalogError('network', { cause: error });
  if (error instanceof HttpErrorResponse) {
    // 0 is a failed fetch; 502-504 is what the service worker answers when the network is down.
    if ([0, 502, 503, 504].includes(error.status)) {
      return new CatalogError('network', { cause: error });
    }
    if (error.status === 404) return new CatalogError('not-found', { cause: error });
  }
  return new CatalogError('unknown', { cause: error });
}
