import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GrButton } from '@grass-ds/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { cardImageUrl } from '../../catalog/card.model';
import { CollectionStore } from '../../collection/collection.store';
import { CardImage } from '../../shared/ui/card-image/card-image';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';

@Component({
  selector: 'pb-collection-page',
  imports: [TranslocoPipe, RouterLink, GrButton, CardImage, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gr-stack">
      <h1 class="gr-display">{{ 'collection.title' | transloco }}</h1>

      @switch (store.status()) {
        @case ('error') {
          <section class="gr-card" aria-labelledby="coll-error-title">
            <div class="gr-card__body gr-stack">
              <h2 class="gr-card__title" id="coll-error-title">
                {{ 'collection.errorTitle' | transloco }}
              </h2>
              <p role="alert">
                {{ 'collection.errors.' + (store.error()?.code ?? 'unknown') | transloco }}
              </p>
              <button grButton type="button" (click)="store.refresh()">
                {{ 'search.retry' | transloco }}
              </button>
            </div>
          </section>
        }
        @case ('loaded') {
          @if (store.isEmpty()) {
            <section class="gr-card" aria-labelledby="empty-title">
              <div class="gr-card__body gr-stack">
                <h2 class="gr-card__title" id="empty-title">
                  {{ 'collection.emptyTitle' | transloco }}
                </h2>
                <p class="gr-text-muted">{{ 'collection.emptyBody' | transloco }}</p>
                <a grButton routerLink="/search">{{ 'collection.findCards' | transloco }}</a>
              </div>
            </section>
          } @else {
            <p class="gr-text-muted" aria-live="polite">
              {{
                'collection.summary'
                  | transloco: { entries: store.cards().length, copies: store.totalCopies() }
              }}
            </p>
            <ul class="pb-owned-list">
              @for (owned of store.cards(); track owned.id) {
                <li class="gr-card">
                  <div class="gr-card__body pb-owned">
                    <a [routerLink]="['/card', owned.cardId]" [attr.aria-label]="owned.cardName">
                      <pb-card-image
                        [src]="image(owned)"
                        [alt]="owned.cardName + ' ' + (owned.cardNumber ?? '')"
                      />
                    </a>
                    <div class="gr-stack">
                      <h2 class="gr-card__title">{{ owned.cardName }}</h2>
                      <p class="gr-text-small gr-text-muted">
                        {{ owned.setName }} · #{{ owned.cardNumber }}
                      </p>
                      <ul class="pb-owned__meta">
                        <li class="pb-owned__qty">×{{ owned.quantity }}</li>
                        <li>{{ 'condition.' + owned.condition | transloco }}</li>
                        <li>{{ 'language.' + owned.language | transloco }}</li>
                        <li>{{ 'finish.' + owned.finish | transloco }}</li>
                      </ul>
                    </div>
                  </div>
                </li>
              }
            </ul>
          }
        }
        @default {
          <ul class="pb-owned-list" aria-hidden="true">
            @for (n of placeholders; track n) {
              <li><pb-skeleton [shape]="'text'" /></li>
            }
          </ul>
        }
      }
    </div>
  `,
})
export class CollectionPage {
  protected readonly store = inject(CollectionStore);
  protected readonly placeholders = [1, 2, 3];
  protected readonly image = (owned: { imageBase: string | null }) => cardImageUrl(owned, 'low');

  constructor() {
    void this.store.ensureLoaded();
  }
}
