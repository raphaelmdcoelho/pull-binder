import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/**
 * Whether the browser thinks it has a network. `navigator.onLine` only reports "no network at all"
 * reliably (a captive portal or a dead Wi-Fi still reads as online), so callers must keep handling
 * real network errors; this just lets the UI react at once when airplane mode is switched on.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  private readonly win = inject(DOCUMENT).defaultView;
  private readonly _online = signal(this.win?.navigator?.onLine ?? true);

  readonly online = this._online.asReadonly();

  constructor() {
    const win = this.win;
    if (!win) return;
    const goOnline = () => this._online.set(true);
    const goOffline = () => this._online.set(false);
    win.addEventListener('online', goOnline);
    win.addEventListener('offline', goOffline);
    inject(DestroyRef).onDestroy(() => {
      win.removeEventListener('online', goOnline);
      win.removeEventListener('offline', goOffline);
    });
  }
}
