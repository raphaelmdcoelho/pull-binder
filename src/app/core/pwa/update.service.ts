import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, InjectionToken, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/** How often an open app asks the server whether a new version exists. */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** Restarts the page; a token so tests can observe it (jsdom cannot reload). */
export const PAGE_RELOAD = new InjectionToken<() => void>('PAGE_RELOAD', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT);
    return () => document.location.reload();
  },
});

/**
 * Tells the UI when a new version has been downloaded and is waiting. Nothing reloads by itself, so
 * the user never loses a half-filled form; `reload()` activates the waiting version and restarts.
 */
@Injectable({ providedIn: 'root' })
export class UpdateService {
  private readonly updates = inject(SwUpdate);
  private readonly document = inject(DOCUMENT);
  private readonly pageReload = inject(PAGE_RELOAD);

  private readonly _ready = signal(false);
  /** A new version is installed and waiting for a reload. */
  readonly updateReady = this._ready.asReadonly();

  constructor() {
    if (!this.updates.isEnabled) return;
    const subscriptions = [
      this.updates.versionUpdates.subscribe((event) => {
        if (event.type === 'VERSION_READY') this._ready.set(true);
      }),
      // The cached files no longer match the server; only a reload can recover.
      this.updates.unrecoverable.subscribe(() => this._ready.set(true)),
    ];
    const timer = setInterval(() => void this.check(), UPDATE_CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (this.document.visibilityState === 'visible') void this.check();
    };
    this.document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      subscriptions.forEach((s) => s.unsubscribe());
      clearInterval(timer);
      this.document.removeEventListener('visibilitychange', onVisible);
    });
  }

  /** Asks the server for a newer version. Never throws: offline simply finds nothing. */
  async check(): Promise<void> {
    if (!this.updates.isEnabled) return;
    try {
      await this.updates.checkForUpdate();
    } catch {
      // Offline or the server is unreachable; the next check tries again.
    }
  }

  async reload(): Promise<void> {
    try {
      if (this.updates.isEnabled) await this.updates.activateUpdate();
    } finally {
      this.pageReload();
    }
  }
}
