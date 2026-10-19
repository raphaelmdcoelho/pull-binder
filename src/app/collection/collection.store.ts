import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Finish } from '../catalog/card.model';
import { AuthService } from '../core/auth/auth.service';
import { ConnectivityService } from '../core/pwa/connectivity.service';
import { CollectionSnapshots } from './collection-snapshot';
import { applyCollectionQuery, summarizeCards } from './collection-query';
import {
  CardLanguage,
  CollectionFilters,
  CollectionQuery,
  CollectionSort,
  CollectionSummary,
  Condition,
  NO_FILTERS,
  OwnedCard,
  OwnedCardUpdate,
  SetOption,
  UpdateResult,
  activeFilterCount,
  hasActiveFilters,
} from './owned-card.model';
import { OwnedCardsError, OwnedCardsRepository } from './owned-cards.repository';

export type CollectionStatus = 'idle' | 'loading' | 'loaded' | 'error';

export const PAGE_SIZE = 30;

function asError(error: unknown): OwnedCardsError {
  return error instanceof OwnedCardsError
    ? error
    : new OwnedCardsError('unknown', { cause: error });
}

/**
 * The signed-in user's Collection: filters and sort live here and are applied by the server, the
 * list grows page by page, and the summary always describes everything that matches (not only the
 * loaded pages). Lives in root so the view survives tab switches.
 */
@Injectable({ providedIn: 'root' })
export class CollectionStore {
  private readonly repository = inject(OwnedCardsRepository);
  private readonly connectivity = inject(ConnectivityService);
  private readonly snapshots = inject(CollectionSnapshots);
  private readonly auth = inject(AuthService);

  private readonly _filters = signal<CollectionFilters>({ ...NO_FILTERS });
  private readonly _sort = signal<CollectionSort>('updated');
  private readonly _cards = signal<OwnedCard[]>([]);
  private readonly _status = signal<CollectionStatus>('idle');
  private readonly _error = signal<OwnedCardsError | null>(null);
  private readonly _loadMoreError = signal<OwnedCardsError | null>(null);
  private readonly _loadingMore = signal(false);
  private readonly _refreshing = signal(false);
  private readonly _hasMore = signal(false);
  private readonly _summary = signal<CollectionSummary | null>(null);
  private readonly _sets = signal<SetOption[]>([]);
  private readonly _cachedAt = signal<number | null>(null);
  private readonly _cachedPartial = signal(false);

  readonly filters = this._filters.asReadonly();
  readonly sort = this._sort.asReadonly();
  readonly cards = this._cards.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly loadMoreError = this._loadMoreError.asReadonly();
  readonly loadingMore = this._loadingMore.asReadonly();
  /** True while a filter or sort change reloads a list that is already on screen. */
  readonly refreshing = this._refreshing.asReadonly();
  readonly hasMore = this._hasMore.asReadonly();
  readonly summary = this._summary.asReadonly();
  readonly sets = this._sets.asReadonly();
  readonly online = this.connectivity.online;
  /** Epoch ms of the saved copy being shown instead of live data, or null when the data is live. */
  readonly cachedAt = this._cachedAt.asReadonly();
  /** The saved copy holds only part of the Collection (the user had not scrolled through it all). */
  readonly cachedPartial = this._cachedPartial.asReadonly();

  readonly filtersActive = computed(() => hasActiveFilters(this._filters()));
  readonly activeFilterCount = computed(() => activeFilterCount(this._filters()));
  /** Nothing owned at all (no filter is hiding anything). */
  readonly isEmpty = computed(
    () => this._status() === 'loaded' && this._cards().length === 0 && !this.filtersActive(),
  );
  /** Something is owned but nothing matches the current filters. */
  readonly isFilteredEmpty = computed(
    () => this._status() === 'loaded' && this._cards().length === 0 && this.filtersActive(),
  );

  private stale = true;
  private requestId = 0;

  constructor() {
    let lastUserId: string | null | undefined;
    effect(() => {
      const userId = this.auth.user()?.id ?? null;
      untracked(() => {
        if (lastUserId !== undefined && userId !== lastUserId) {
          this.reset();
          // Signing out (or switching account) must not leave the previous Collection on the device.
          if (userId === null) void this.snapshots.clear();
        }
        lastUserId = userId;
      });
    });
    // Back online while showing a saved copy: fetch the live Collection.
    effect(() => {
      if (this.connectivity.online() && untracked(() => this._cachedAt() !== null)) {
        untracked(() => void this.reload());
      }
    });
  }

  private query(): CollectionQuery {
    return { ...this._filters(), sort: this._sort() };
  }

  /** Loads when never loaded or after a change; otherwise keeps what is shown. */
  async ensureLoaded(): Promise<void> {
    if (this.stale) await this.reload();
  }

  /** First page, summary and set options, for the current filters and sort. */
  async reload(): Promise<void> {
    const id = ++this.requestId;
    const query = this.query();
    // Keep the current list on screen while a filter change reloads it.
    if (this._status() === 'loaded') this._refreshing.set(true);
    else this._status.set('loading');
    this._error.set(null);
    this._loadMoreError.set(null);
    this._loadingMore.set(false);
    if (!this.connectivity.online()) {
      await this.showSavedCopy(id, query, new OwnedCardsError('offline'));
      return;
    }
    try {
      const [page, summary, sets] = await Promise.all([
        this.repository.list(query, { offset: 0, limit: PAGE_SIZE }),
        this.repository.summarize(query),
        this.repository.listSets(),
      ]);
      if (id !== this.requestId) return;
      this._cards.set(page.items);
      this._hasMore.set(page.hasMore);
      this._summary.set(summary);
      this._sets.set(sets);
      this._cachedAt.set(null);
      this._cachedPartial.set(false);
      this._status.set('loaded');
      this._refreshing.set(false);
      this.stale = false;
      void this.persist();
    } catch (error) {
      if (id !== this.requestId) return;
      const failure = asError(error);
      if (failure.code === 'network') {
        await this.showSavedCopy(id, query, failure);
        return;
      }
      this._error.set(failure);
      this._refreshing.set(false);
      this._status.set('error');
    }
  }

  async loadMore(): Promise<void> {
    if (this._loadingMore() || !this._hasMore() || this._status() !== 'loaded') return;
    const id = this.requestId;
    this._loadingMore.set(true);
    this._loadMoreError.set(null);
    try {
      const page = await this.repository.list(this.query(), {
        offset: this._cards().length,
        limit: PAGE_SIZE,
      });
      if (id !== this.requestId) return;
      this._cards.update((cards) => [
        ...cards,
        ...page.items.filter((c) => !cards.some((o) => o.id === c.id)),
      ]);
      this._hasMore.set(page.hasMore);
      void this.persist();
    } catch (error) {
      if (id !== this.requestId) return;
      this._loadMoreError.set(asError(error));
    } finally {
      if (id === this.requestId) this._loadingMore.set(false);
    }
  }

  setText(text: string): Promise<void> {
    return this.change(() => this._filters.update((f) => ({ ...f, text })));
  }

  setSet(setId: string | null): Promise<void> {
    return this.change(() => this._filters.update((f) => ({ ...f, setId })));
  }

  setCondition(condition: Condition | null): Promise<void> {
    return this.change(() => this._filters.update((f) => ({ ...f, condition })));
  }

  setLanguage(language: CardLanguage | null): Promise<void> {
    return this.change(() => this._filters.update((f) => ({ ...f, language })));
  }

  setFinish(finish: Finish | null): Promise<void> {
    return this.change(() => this._filters.update((f) => ({ ...f, finish })));
  }

  setSort(sort: CollectionSort): Promise<void> {
    return this.change(() => this._sort.set(sort));
  }

  clearFilters(): Promise<void> {
    return this.change(() => this._filters.set({ ...NO_FILTERS }));
  }

  /**
   * Edits an Owned card and patches the list in place (no flicker, no lost scroll). A merge removes
   * the edited row and updates the one that absorbed it. Throws the typed error to the caller.
   */
  async update(card: OwnedCard, patch: OwnedCardUpdate): Promise<UpdateResult> {
    this.assertOnline();
    const result = await this.repository.update(card.id, patch);
    this._cards.update((cards) =>
      result.merged
        ? cards
            .filter((c) => c.id !== card.id)
            .map((c) => (c.id === result.card.id ? result.card : c))
        : cards.map((c) => (c.id === card.id ? result.card : c)),
    );
    void this.refreshSummary();
    return result;
  }

  async remove(card: OwnedCard): Promise<void> {
    this.assertOnline();
    try {
      await this.repository.remove(card.id);
    } catch (error) {
      // Already gone elsewhere: the list should still stop showing it.
      if (!(error instanceof OwnedCardsError && error.code === 'not-found')) throw error;
    }
    this._cards.update((cards) => cards.filter((c) => c.id !== card.id));
    void this.refreshSummary();
    void this.refreshSets();
  }

  /** Called after an add so the next visit to the Collection reloads. */
  markStale(): void {
    this.stale = true;
    void this.refreshSnapshot();
  }

  /** Writes need the server (offline writes are not supported yet). */
  assertOnline(): void {
    if (!this.connectivity.online()) throw new OwnedCardsError('offline');
  }

  /** Forget everything (sign-out), including filters. */
  reset(): void {
    this.requestId++;
    this._filters.set({ ...NO_FILTERS });
    this._sort.set('updated');
    this._cards.set([]);
    this._summary.set(null);
    this._sets.set([]);
    this._hasMore.set(false);
    this._cachedAt.set(null);
    this._cachedPartial.set(false);
    this._status.set('idle');
    this._refreshing.set(false);
    this._error.set(null);
    this._loadMoreError.set(null);
    this.stale = true;
  }

  private change(apply: () => void): Promise<void> {
    apply();
    return this.reload();
  }

  private async refreshSummary(): Promise<void> {
    const id = this.requestId;
    try {
      const summary = await this.repository.summarize(this.query());
      if (id === this.requestId) this._summary.set(summary);
    } catch {
      // The numbers are cosmetic; the next reload corrects them.
    }
    if (id !== this.requestId) return;
    // A write done while filtered changed rows the saved copy still holds; rebuild it.
    if (this.isDefaultView()) await this.persist();
    else await this.refreshSnapshot();
  }

  private async refreshSets(): Promise<void> {
    try {
      this._sets.set(await this.repository.listSets());
    } catch {
      // Keep the options we have.
    }
  }

  private isDefaultView(): boolean {
    return !this.filtersActive() && this._sort() === 'updated';
  }

  /** Keeps the unfiltered view on the device so it can be opened offline. */
  private async persist(): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId || this._cachedAt() !== null || this._status() !== 'loaded') return;
    if (!this.isDefaultView()) return;
    await this.snapshots.save({
      userId,
      cards: this._cards(),
      hasMore: this._hasMore(),
      summary: this._summary(),
      sets: this._sets(),
    });
  }

  /** Re-reads the unfiltered first page and stores it, without touching what is on screen. */
  private async refreshSnapshot(): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId || !this.connectivity.online()) return;
    const query: CollectionQuery = { ...NO_FILTERS, sort: 'updated' };
    try {
      const [page, summary, sets] = await Promise.all([
        this.repository.list(query, { offset: 0, limit: PAGE_SIZE }),
        this.repository.summarize(query),
        this.repository.listSets(),
      ]);
      if (this.auth.user()?.id !== userId) return;
      await this.snapshots.save({
        userId,
        cards: page.items,
        hasMore: page.hasMore,
        summary,
        sets,
      });
    } catch {
      // The old copy stays; the next successful load replaces it.
    }
  }

  /** Offline (or unreachable): show the copy saved on this device, or explain there is none. */
  private async showSavedCopy(
    id: number,
    query: CollectionQuery,
    failure: OwnedCardsError,
  ): Promise<void> {
    const userId = this.auth.user()?.id;
    const snapshot = userId ? await this.snapshots.load(userId) : null;
    if (id !== this.requestId) return;
    this._refreshing.set(false);
    if (!snapshot) {
      this._error.set(failure);
      this._status.set('error');
      return;
    }
    const cards = applyCollectionQuery(snapshot.cards, query);
    this._cards.set(cards);
    this._hasMore.set(false);
    this._summary.set(
      hasActiveFilters(query) ? summarizeCards(cards) : (snapshot.summary ?? summarizeCards(cards)),
    );
    this._sets.set(snapshot.sets);
    this._cachedAt.set(snapshot.savedAt);
    this._cachedPartial.set(snapshot.hasMore);
    this._status.set('loaded');
    this.stale = true;
  }
}
