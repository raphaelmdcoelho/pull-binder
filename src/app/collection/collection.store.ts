import { Injectable, computed, inject, signal } from '@angular/core';
import { OwnedCard } from './owned-card.model';
import { OwnedCardsError, OwnedCardsRepository } from './owned-cards.repository';

export type CollectionStatus = 'idle' | 'loading' | 'loaded' | 'error';

/** The signed-in user's Collection. Full browse and filter come in M5. */
@Injectable({ providedIn: 'root' })
export class CollectionStore {
  private readonly repository = inject(OwnedCardsRepository);

  private readonly _cards = signal<OwnedCard[]>([]);
  private readonly _status = signal<CollectionStatus>('idle');
  private readonly _error = signal<OwnedCardsError | null>(null);

  readonly cards = this._cards.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isEmpty = computed(() => this._status() === 'loaded' && this._cards().length === 0);
  readonly totalCopies = computed(() => this._cards().reduce((sum, c) => sum + c.quantity, 0));

  private stale = true;
  private requestId = 0;

  /** Loads when never loaded or after a change; otherwise keeps what is shown. */
  async ensureLoaded(): Promise<void> {
    if (this.stale) await this.refresh();
  }

  async refresh(): Promise<void> {
    const id = ++this.requestId;
    this._status.set('loading');
    this._error.set(null);
    try {
      const cards = await this.repository.list();
      if (id !== this.requestId) return;
      this._cards.set(cards);
      this._status.set('loaded');
      this.stale = false;
    } catch (error) {
      if (id !== this.requestId) return;
      this._error.set(error instanceof OwnedCardsError ? error : new OwnedCardsError('unknown'));
      this._status.set('error');
    }
  }

  /** Called after an add so the next visit to the Collection reloads. */
  markStale(): void {
    this.stale = true;
  }

  /** Forget everything (sign-out). */
  reset(): void {
    this.requestId++;
    this._cards.set([]);
    this._status.set('idle');
    this._error.set(null);
    this.stale = true;
  }
}
