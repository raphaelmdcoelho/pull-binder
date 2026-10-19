import { Injectable, signal } from '@angular/core';

export interface StatusMessage {
  text: string;
  kind: 'success' | 'error';
}

const VISIBLE_MS = 6000;

/** Announces short outcomes ("Added to your collection") in a live region. Stands in for a toast. */
@Injectable({ providedIn: 'root' })
export class StatusService {
  private readonly _message = signal<StatusMessage | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  readonly message = this._message.asReadonly();

  announce(text: string, kind: StatusMessage['kind'] = 'success'): void {
    clearTimeout(this.timer);
    this._message.set({ text, kind });
    this.timer = setTimeout(() => this._message.set(null), VISIBLE_MS);
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this._message.set(null);
  }
}
