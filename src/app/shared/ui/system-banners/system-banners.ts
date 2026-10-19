import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ConnectivityService } from '../../../core/pwa/connectivity.service';
import { UpdateService } from '../../../core/pwa/update.service';

/**
 * App-wide notices that live under the top bar: "you are offline" and "a new version is ready".
 * The wrapper is always in the DOM so a notice inserted later is announced politely, and neither
 * blocks anything (a reload is the user's choice, so a half-filled form is never lost).
 */
@Component({
  selector: 'pb-system-banners',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="pb-banners" aria-live="polite" aria-atomic="false">
      @if (!connectivity.online()) {
        <p class="pb-banner" data-kind="offline">{{ 'pwa.offline' | transloco }}</p>
      }
      @if (updates.updateReady() && !dismissed()) {
        <div class="pb-banner" data-kind="update">
          <span>{{ 'pwa.updateReady' | transloco }}</span>
          <span class="pb-banner__actions">
            <button type="button" class="pb-banner__button" (click)="updates.reload()">
              {{ 'pwa.reload' | transloco }}
            </button>
            <button type="button" class="pb-banner__button" (click)="dismissed.set(true)">
              {{ 'pwa.later' | transloco }}
            </button>
          </span>
        </div>
      }
    </div>
  `,
})
export class SystemBanners {
  protected readonly connectivity = inject(ConnectivityService);
  protected readonly updates = inject(UpdateService);
  protected readonly dismissed = signal(false);
}
