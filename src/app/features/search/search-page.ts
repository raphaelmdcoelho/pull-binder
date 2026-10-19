import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { ConnectivityService } from '../../core/pwa/connectivity.service';
import { RouterLink } from '@angular/router';
import { GrButton } from '@grass-ds/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { cardImageUrl } from '../../catalog/card.model';
import { CardImage } from '../../shared/ui/card-image/card-image';
import { SearchField } from '../../shared/ui/search-field/search-field';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { Spinner } from '../../shared/ui/spinner/spinner';
import { AddOwnedCardDialog } from '../collection/add/add-owned-card-dialog';
import { SearchStore } from './search.store';

@Component({
  selector: 'pb-search-page',
  imports: [
    TranslocoPipe,
    RouterLink,
    GrButton,
    SearchField,
    Skeleton,
    Spinner,
    CardImage,
    AddOwnedCardDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gr-stack">
      <h1 class="gr-display">{{ 'search.title' | transloco }}</h1>
      <pb-search-field
        [label]="'search.label' | transloco"
        [placeholder]="'search.placeholder' | transloco"
        [clearLabel]="'search.clear' | transloco"
        [value]="store.query()"
        (valueChange)="onTyping($event)"
        (searched)="store.search($event)"
      />

      @if (!connectivity.online()) {
        <p class="gr-text-small gr-text-muted">{{ 'search.offlineHint' | transloco }}</p>
      }

      @switch (store.status()) {
        @case ('idle') {
          <p class="gr-text-muted">
            {{ (store.tooShort() ? 'search.tooShort' : 'search.hint') | transloco }}
          </p>
        }
        @case ('loading') {
          <ul class="pb-card-grid" aria-hidden="true">
            @for (n of placeholders; track n) {
              <li><pb-skeleton /></li>
            }
          </ul>
          <pb-spinner [label]="'search.loading' | transloco" />
        }
        @case ('error') {
          <section class="gr-card" aria-labelledby="search-error-title">
            <div class="gr-card__body gr-stack">
              <h2 class="gr-card__title" id="search-error-title">
                {{ 'search.errorTitle' | transloco }}
              </h2>
              <p role="alert">
                {{
                  (!connectivity.online() && store.error()?.code === 'network'
                    ? 'search.errors.offline'
                    : 'search.errors.' + (store.error()?.code ?? 'unknown')
                  ) | transloco
                }}
              </p>
              <button grButton type="button" (click)="store.retry()">
                {{ 'search.retry' | transloco }}
              </button>
            </div>
          </section>
        }
        @case ('loaded') {
          @if (store.isEmpty()) {
            <section class="gr-card" aria-labelledby="search-empty-title">
              <div class="gr-card__body gr-stack">
                <h2 class="gr-card__title" id="search-empty-title">
                  {{ 'search.emptyTitle' | transloco }}
                </h2>
                <p class="gr-text-muted">
                  {{ 'search.emptyBody' | transloco: { query: store.query().trim() } }}
                </p>
              </div>
            </section>
          } @else {
            @if (store.fellBackToEnglish()) {
              <p class="gr-text-muted" role="status">{{ 'search.fellBack' | transloco }}</p>
            }
            <p class="gr-text-small gr-text-muted" aria-live="polite">
              {{ 'search.count' | transloco: { count: store.cards().length } }}
            </p>
            <ul class="pb-card-grid">
              @for (card of store.cards(); track card.id) {
                <li>
                  <a class="pb-card-grid__link" [routerLink]="['/card', card.id]">
                    <pb-card-image [src]="imageUrl(card)" [alt]="card.name + ' ' + card.number" />
                    <span class="pb-card-grid__name">{{ card.name }}</span>
                    <span class="gr-text-small gr-text-muted">#{{ card.number }}</span>
                  </a>
                  <button
                    grButton
                    variant="secondary"
                    type="button"
                    [disabled]="!connectivity.online()"
                    [attr.aria-label]="
                      ('add.quick' | transloco) + ': ' + card.name + ' #' + card.number
                    "
                    (click)="add().openFor(card.id)"
                  >
                    {{ 'add.quickShort' | transloco }}
                  </button>
                </li>
              }
            </ul>
            @if (store.error(); as err) {
              <p role="alert" class="gr-field__error">
                {{ 'search.errors.' + err.code | transloco }}
              </p>
            }
            @if (store.hasMore()) {
              <button
                grButton
                variant="secondary"
                type="button"
                [disabled]="store.loadingMore()"
                (click)="store.loadMore()"
              >
                {{ (store.loadingMore() ? 'search.loading' : 'search.loadMore') | transloco }}
              </button>
            }
          }
        }
      }
    </div>
    <pb-add-owned-card-dialog />
  `,
})
export class SearchPage {
  protected readonly store = inject(SearchStore);
  protected readonly connectivity = inject(ConnectivityService);
  protected readonly add = viewChild.required(AddOwnedCardDialog);
  protected readonly placeholders = [1, 2, 3, 4, 5, 6];
  protected readonly imageUrl = (card: Parameters<typeof cardImageUrl>[0]) =>
    cardImageUrl(card, 'low');

  /** Clearing the box resets immediately instead of waiting for the debounce. */
  protected onTyping(value: string): void {
    if (value.trim() === '' && this.store.query() !== '') void this.store.search('');
  }
}
