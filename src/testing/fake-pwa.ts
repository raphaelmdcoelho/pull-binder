import { Provider, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { ConnectivityService } from '../app/core/pwa/connectivity.service';
import { PAGE_RELOAD } from '../app/core/pwa/update.service';
import {
  COLLECTION_SNAPSHOT_STORAGE,
  SnapshotStorage,
} from '../app/collection/collection-snapshot';

/** A connectivity service tests can flip: `fake.set(false)` is airplane mode. */
export class FakeConnectivity {
  private readonly _online = signal(true);
  readonly online = this._online.asReadonly();
  set(online: boolean): void {
    this._online.set(online);
  }
}

export function provideFakeConnectivity(fake: FakeConnectivity): Provider {
  return { provide: ConnectivityService, useValue: fake };
}

/** IndexedDB stand-in that keeps structured clones, like the real thing. */
export class MemorySnapshotStorage implements SnapshotStorage {
  readonly data = new Map<string, unknown>();
  async get(key: string): Promise<unknown> {
    const value = this.data.get(key);
    return value === undefined ? undefined : structuredClone(value);
  }
  async set(key: string, value: unknown): Promise<void> {
    this.data.set(key, structuredClone(value));
  }
  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
}

export function provideMemorySnapshots(storage: MemorySnapshotStorage): Provider {
  return { provide: COLLECTION_SNAPSHOT_STORAGE, useValue: storage };
}

/** The slice of SwUpdate the app uses. */
export class FakeSwUpdate {
  isEnabled = true;
  readonly versionUpdates = new Subject<{ type: string }>();
  readonly unrecoverable = new Subject<{ reason: string }>();
  checkForUpdate = vi.fn(async () => true);
  activateUpdate = vi.fn(async () => true);
}

export function provideFakeSwUpdate(fake: FakeSwUpdate, reload = vi.fn()): Provider[] {
  return [
    { provide: SwUpdate, useValue: fake },
    { provide: PAGE_RELOAD, useValue: reload },
  ];
}
