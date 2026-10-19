import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GrButton } from '@grass-ds/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { Finish, cardImageUrl } from '../../catalog/card.model';
import { CollectionStore } from '../../collection/collection.store';
import {
  CARD_LANGUAGES,
  COLLECTION_SORTS,
  CONDITIONS,
  CardLanguage,
  CollectionSort,
  Condition,
} from '../../collection/owned-card.model';
import { LanguageService } from '../../core/i18n/language.service';
import { CardImage } from '../../shared/ui/card-image/card-image';
import { SearchField } from '../../shared/ui/search-field/search-field';
import { PbSelect } from '../../shared/ui/select/select';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { Spinner } from '../../shared/ui/spinner/spinner';
import { EditOwnedCardDialog } from './edit/edit-owned-card-dialog';
import { RemoveOwnedCardDialog } from './remove/remove-owned-card-dialog';

const FINISHES: readonly Finish[] = ['normal', 'holo', 'reverse_holo', 'other'];

@Component({
  selector: 'pb-collection-page',
  imports: [
    TranslocoPipe,
    RouterLink,
    GrButton,
    CardImage,
    Skeleton,
    Spinner,
    SearchField,
    PbSelect,
    EditOwnedCardDialog,
    RemoveOwnedCardDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gr-stack">
      <h1 class="gr-display">{{ 'collection.title' | transloco }}</h1>

      @if (!store.online() || store.cachedAt() !== null) {
        <section class="gr-text-small gr-text-muted" id="collection-offline-note">
          @if (savedAt(); as when) {
            <p>{{ 'collection.offline.savedCopy' | transloco: { when: when } }}</p>
            @if (store.cachedPartial()) {
              <p>{{ 'collection.offline.partial' | transloco }}</p>
            }
          }
          <p>{{ 'pwa.writeDisabled' | transloco }}</p>
        </section>
      }

      @if (store.status() === 'loaded' && !store.isEmpty()) {
        <pb-search-field
          [label]="'collection.search.label' | transloco"
          [placeholder]="'collection.search.placeholder' | transloco"
          [clearLabel]="'search.clear' | transloco"
          [value]="store.filters().text"
          (valueChange)="onTyping($event)"
          (searched)="store.setText($event)"
        />

        <details class="pb-filters">
          <summary>
            {{ 'collection.filters.title' | transloco }}
            @if (store.activeFilterCount() > 0) {
              <span class="pb-filters__count">({{ store.activeFilterCount() }})</span>
            }
          </summary>
          <div class="pb-filters__grid">
            <div class="gr-field">
              <label class="gr-field__label" for="f-set">{{
                'collection.filters.set' | transloco
              }}</label>
              <select
                pbSelect
                id="f-set"
                (change)="store.setSet($any($event.target).value || null)"
              >
                <option value="" [selected]="!store.filters().setId">
                  {{ 'collection.filters.any' | transloco }}
                </option>
                @for (s of store.sets(); track s.id) {
                  <option [value]="s.id" [selected]="s.id === store.filters().setId">
                    {{ s.name }}
                  </option>
                }
              </select>
            </div>
            <div class="gr-field">
              <label class="gr-field__label" for="f-condition">{{
                'add.condition' | transloco
              }}</label>
              <select pbSelect id="f-condition" (change)="onCondition($any($event.target).value)">
                <option value="" [selected]="!store.filters().condition">
                  {{ 'collection.filters.any' | transloco }}
                </option>
                @for (c of conditions; track c) {
                  <option [value]="c" [selected]="c === store.filters().condition">
                    {{ 'condition.' + c | transloco }}
                  </option>
                }
              </select>
            </div>
            <div class="gr-field">
              <label class="gr-field__label" for="f-language">{{
                'add.language' | transloco
              }}</label>
              <select pbSelect id="f-language" (change)="onLanguage($any($event.target).value)">
                <option value="" [selected]="!store.filters().language">
                  {{ 'collection.filters.any' | transloco }}
                </option>
                @for (l of languages; track l) {
                  <option [value]="l" [selected]="l === store.filters().language">
                    {{ 'language.' + l | transloco }}
                  </option>
                }
              </select>
            </div>
            <div class="gr-field">
              <label class="gr-field__label" for="f-finish">{{ 'add.finish' | transloco }}</label>
              <select pbSelect id="f-finish" (change)="onFinish($any($event.target).value)">
                <option value="" [selected]="!store.filters().finish">
                  {{ 'collection.filters.any' | transloco }}
                </option>
                @for (f of finishes; track f) {
                  <option [value]="f" [selected]="f === store.filters().finish">
                    {{ 'finish.' + f | transloco }}
                  </option>
                }
              </select>
            </div>
          </div>
          @if (store.filtersActive()) {
            <button grButton variant="secondary" type="button" (click)="store.clearFilters()">
              {{ 'collection.filters.clear' | transloco }}
            </button>
          }
        </details>

        <div class="gr-field">
          <label class="gr-field__label" for="sort">{{
            'collection.sort.label' | transloco
          }}</label>
          <select pbSelect id="sort" (change)="onSort($any($event.target).value)">
            @for (s of sorts; track s) {
              <option [value]="s" [selected]="s === store.sort()">
                {{ 'collection.sort.' + s | transloco }}
              </option>
            }
          </select>
        </div>

        @if (store.summary(); as summary) {
          <p class="gr-text-muted" aria-live="polite">
            {{
              (store.filtersActive() ? 'collection.summaryFiltered' : 'collection.summary')
                | transloco: { entries: summary.entries, copies: summary.copies }
            }}
          </p>
        }
      }

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
              <button grButton type="button" (click)="store.reload()">
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
          } @else if (store.isFilteredEmpty()) {
            <section class="gr-card" aria-labelledby="filtered-title">
              <div class="gr-card__body gr-stack">
                <h2 class="gr-card__title" id="filtered-title">
                  {{ 'collection.filteredEmptyTitle' | transloco }}
                </h2>
                <p class="gr-text-muted">{{ 'collection.filteredEmptyBody' | transloco }}</p>
                <button grButton type="button" (click)="store.clearFilters()">
                  {{ 'collection.filters.clear' | transloco }}
                </button>
              </div>
            </section>
          } @else {
            <ul class="pb-owned-list" [attr.aria-busy]="store.refreshing()">
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
                      <div class="pb-owned__actions">
                        <button
                          grButton
                          variant="secondary"
                          type="button"
                          [disabled]="!store.online()"
                          [attr.aria-describedby]="
                            store.online() ? null : 'collection-offline-note'
                          "
                          [attr.aria-label]="
                            ('collection.edit' | transloco) + ': ' + owned.cardName
                          "
                          (click)="edit().openFor(owned)"
                        >
                          {{ 'collection.edit' | transloco }}
                        </button>
                        <button
                          grButton
                          variant="secondary"
                          type="button"
                          [disabled]="!store.online()"
                          [attr.aria-describedby]="
                            store.online() ? null : 'collection-offline-note'
                          "
                          [attr.aria-label]="
                            ('collection.remove' | transloco) + ': ' + owned.cardName
                          "
                          (click)="remove().openFor(owned)"
                        >
                          {{ 'collection.remove' | transloco }}
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              }
            </ul>
            @if (store.loadMoreError(); as err) {
              <p role="alert" class="gr-field__error">
                {{ 'collection.errors.' + err.code | transloco }}
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
        @default {
          <ul class="pb-owned-list" aria-hidden="true">
            @for (n of placeholders; track n) {
              <li><pb-skeleton [shape]="'text'" /></li>
            }
          </ul>
          <pb-spinner [label]="'search.loading' | transloco" />
        }
      }
    </div>
    <pb-edit-owned-card-dialog />
    <pb-remove-owned-card-dialog />
  `,
})
export class CollectionPage {
  protected readonly store = inject(CollectionStore);
  private readonly language = inject(LanguageService);
  /** When the copy on screen was saved, in the app language; null while the data is live. */
  protected readonly savedAt = computed(() => {
    const at = this.store.cachedAt();
    return at === null
      ? null
      : new Intl.DateTimeFormat(this.language.current(), {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(at);
  });
  protected readonly edit = viewChild.required(EditOwnedCardDialog);
  protected readonly remove = viewChild.required(RemoveOwnedCardDialog);

  protected readonly placeholders = [1, 2, 3];
  protected readonly conditions = CONDITIONS;
  protected readonly languages = CARD_LANGUAGES;
  protected readonly finishes = FINISHES;
  protected readonly sorts = COLLECTION_SORTS;
  protected readonly image = (owned: { imageBase: string | null }) => cardImageUrl(owned, 'low');

  constructor() {
    void this.store.ensureLoaded();
  }

  /** Clearing the box applies at once instead of waiting for the debounce. */
  protected onTyping(value: string): void {
    if (value.trim() === '' && this.store.filters().text !== '') void this.store.setText('');
  }

  protected onCondition(value: string): void {
    void this.store.setCondition((value || null) as Condition | null);
  }

  protected onLanguage(value: string): void {
    void this.store.setLanguage((value || null) as CardLanguage | null);
  }

  protected onFinish(value: string): void {
    void this.store.setFinish((value || null) as Finish | null);
  }

  protected onSort(value: string): void {
    void this.store.setSort(value as CollectionSort);
  }
}
