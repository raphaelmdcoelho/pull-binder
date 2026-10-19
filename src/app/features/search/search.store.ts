import { Injectable, computed, inject, signal } from '@angular/core';
import { CardSummary } from '../../catalog/card.model';
import { CatalogError, CatalogService, toCatalogLang } from '../../catalog/catalog.service';
import { LanguageService } from '../../core/i18n/language.service';

export const MIN_QUERY_LENGTH = 2;

export type SearchStatus = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * State of the catalog search. Lives in root so the results survive switching tabs.
 * Only the newest request may write results (a slow answer to an old query is dropped).
 */
@Injectable({ providedIn: 'root' })
export class SearchStore {
  private readonly catalog = inject(CatalogService);
  private readonly language = inject(LanguageService);

  private readonly _query = signal('');
  private readonly _cards = signal<CardSummary[]>([]);
  private readonly _status = signal<SearchStatus>('idle');
  private readonly _loadingMore = signal(false);
  private readonly _hasMore = signal(false);
  private readonly _fellBack = signal(false);
  private readonly _error = signal<CatalogError | null>(null);

  readonly query = this._query.asReadonly();
  readonly cards = this._cards.asReadonly();
  readonly status = this._status.asReadonly();
  readonly loadingMore = this._loadingMore.asReadonly();
  readonly hasMore = this._hasMore.asReadonly();
  readonly fellBackToEnglish = this._fellBack.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isEmpty = computed(() => this._status() === 'loaded' && this._cards().length === 0);
  readonly tooShort = computed(() => {
    const length = this._query().trim().length;
    return length > 0 && length < MIN_QUERY_LENGTH;
  });

  private requestId = 0;
  private page = 1;
  private lang = 'en';

  async search(query: string): Promise<void> {
    const trimmed = query.trim();
    this._query.set(query);
    const id = ++this.requestId;
    this._error.set(null);
    this._loadingMore.set(false);
    if (trimmed.length < MIN_QUERY_LENGTH) {
      this._cards.set([]);
      this._hasMore.set(false);
      this._fellBack.set(false);
      this._status.set('idle');
      return;
    }
    this._status.set('loading');
    this.page = 1;
    this.lang = toCatalogLang(this.language.current());
    try {
      const result = await this.catalog.searchCards({ query: trimmed, lang: this.lang, page: 1 });
      if (id !== this.requestId) return;
      this.lang = result.lang;
      this._cards.set(result.cards);
      this._hasMore.set(result.hasMore);
      this._fellBack.set(result.fellBackToEnglish);
      this._status.set('loaded');
    } catch (error) {
      if (id !== this.requestId) return;
      this._cards.set([]);
      this._hasMore.set(false);
      this._error.set(asCatalogError(error));
      this._status.set('error');
    }
  }

  async loadMore(): Promise<void> {
    if (this._loadingMore() || !this._hasMore() || this._status() !== 'loaded') return;
    const id = this.requestId;
    this._loadingMore.set(true);
    try {
      const result = await this.catalog.searchCards({
        query: this._query().trim(),
        lang: this.lang,
        page: this.page + 1,
      });
      if (id !== this.requestId) return;
      this.page = result.page;
      this._cards.update((cards) => [
        ...cards,
        ...result.cards.filter((c) => !cards.some((o) => o.id === c.id)),
      ]);
      this._hasMore.set(result.hasMore);
    } catch (error) {
      if (id !== this.requestId) return;
      this._error.set(asCatalogError(error));
    } finally {
      if (id === this.requestId) this._loadingMore.set(false);
    }
  }

  retry(): Promise<void> {
    return this.search(this._query());
  }
}

function asCatalogError(error: unknown): CatalogError {
  return error instanceof CatalogError ? error : new CatalogError('unknown', { cause: error });
}
