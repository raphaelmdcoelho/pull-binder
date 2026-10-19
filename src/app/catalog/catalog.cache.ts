import { Injectable, InjectionToken, inject } from '@angular/core';
import { createStore, get, set } from 'idb-keyval';

export interface PersistentStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

/** IndexedDB when the browser has it, otherwise null and the cache is memory-only. */
export const CATALOG_PERSISTENCE = new InjectionToken<PersistentStore | null>(
  'CATALOG_PERSISTENCE',
  {
    providedIn: 'root',
    factory: () => {
      if (typeof indexedDB === 'undefined') return null;
      const store = createStore('pull-binder', 'catalog');
      return { get: (key) => get(key, store), set: (key, value) => set(key, value, store) };
    },
  },
);

interface Entry<T> {
  at: number;
  value: T;
}

export interface CacheHit<T> {
  value: T;
  /** False when older than the ttl: only worth using if the network fails. */
  fresh: boolean;
}

/** Card JSON cache: memory first, IndexedDB behind it. Never throws. */
@Injectable({ providedIn: 'root' })
export class CatalogCache {
  private readonly memory = new Map<string, Entry<unknown>>();
  private readonly persistent = inject(CATALOG_PERSISTENCE);

  async get<T>(key: string, ttlMs: number): Promise<CacheHit<T> | null> {
    let entry = this.memory.get(key) as Entry<T> | undefined;
    if (!entry && this.persistent) {
      try {
        const stored = (await this.persistent.get(key)) as Entry<T> | undefined;
        if (stored && typeof stored.at === 'number') {
          entry = stored;
          this.memory.set(key, stored);
        }
      } catch {
        // A blocked or broken IndexedDB just means no persistent cache.
      }
    }
    return entry ? { value: entry.value, fresh: Date.now() - entry.at < ttlMs } : null;
  }

  async put<T>(key: string, value: T): Promise<void> {
    const entry: Entry<T> = { at: Date.now(), value };
    this.memory.set(key, entry);
    try {
      await this.persistent?.set(key, entry);
    } catch {
      // Quota or private mode: keep the memory copy only.
    }
  }
}
