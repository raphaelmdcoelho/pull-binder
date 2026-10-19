import { Injectable, InjectionToken, inject } from '@angular/core';
import { createStore, del, get, set } from 'idb-keyval';
import { CollectionSummary, OwnedCard, SetOption } from './owned-card.model';

/** What was on screen the last time the unfiltered Collection loaded, so it can be shown offline. */
export interface CollectionSnapshot {
  version: typeof SNAPSHOT_VERSION;
  /** Whose Collection this is. A snapshot is never served to anyone else. */
  userId: string;
  /** Epoch milliseconds. */
  savedAt: number;
  cards: OwnedCard[];
  /** True when the user owns more cards than the pages that had been loaded. */
  hasMore: boolean;
  summary: CollectionSummary | null;
  sets: SetOption[];
}

const SNAPSHOT_VERSION = 1;
const KEY = 'snapshot';

export interface SnapshotStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

/** IndexedDB when the browser has it, otherwise null and nothing is kept for offline use. */
export const COLLECTION_SNAPSHOT_STORAGE = new InjectionToken<SnapshotStorage | null>(
  'COLLECTION_SNAPSHOT_STORAGE',
  {
    providedIn: 'root',
    factory: () => {
      if (typeof indexedDB === 'undefined') return null;
      const store = createStore('pull-binder-collection', 'snapshots');
      return {
        get: (key) => get(key, store),
        set: (key, value) => set(key, value, store),
        delete: (key) => del(key, store),
      };
    },
  },
);

function isSnapshot(value: unknown): value is CollectionSnapshot {
  const v = value as Partial<CollectionSnapshot> | null;
  return (
    !!v &&
    v.version === SNAPSHOT_VERSION &&
    typeof v.userId === 'string' &&
    typeof v.savedAt === 'number' &&
    Array.isArray(v.cards) &&
    Array.isArray(v.sets) &&
    typeof v.hasMore === 'boolean'
  );
}

/**
 * Persists one snapshot of the signed-in user's Collection. It holds a single record: signing in as
 * someone else replaces it, signing out deletes it, and a read for a different user finds nothing.
 * Never throws: a blocked or full IndexedDB just means no offline copy.
 */
@Injectable({ providedIn: 'root' })
export class CollectionSnapshots {
  private readonly storage = inject(COLLECTION_SNAPSHOT_STORAGE);

  async load(userId: string): Promise<CollectionSnapshot | null> {
    try {
      const stored = await this.storage?.get(KEY);
      return isSnapshot(stored) && stored.userId === userId ? stored : null;
    } catch {
      return null;
    }
  }

  async save(snapshot: Omit<CollectionSnapshot, 'version' | 'savedAt'>): Promise<void> {
    try {
      await this.storage?.set(KEY, { ...snapshot, version: SNAPSHOT_VERSION, savedAt: Date.now() });
    } catch {
      // Quota or private mode: the Collection just is not available offline.
    }
  }

  async clear(): Promise<void> {
    try {
      await this.storage?.delete(KEY);
    } catch {
      // Nothing more to do.
    }
  }
}
