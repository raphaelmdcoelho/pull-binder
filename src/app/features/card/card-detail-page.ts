import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { GrButton } from '@grass-ds/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { Card, cardImageUrl } from '../../catalog/card.model';
import { CatalogError, CatalogService, toCatalogLang } from '../../catalog/catalog.service';
import { LanguageService } from '../../core/i18n/language.service';
import { CardImage } from '../../shared/ui/card-image/card-image';
import { Spinner } from '../../shared/ui/spinner/spinner';
import { AddOwnedCardDialog } from '../collection/add/add-owned-card-dialog';

@Component({
  selector: 'pb-card-detail-page',
  imports: [TranslocoPipe, RouterLink, GrButton, CardImage, Spinner, AddOwnedCardDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gr-stack">
      <a routerLink="/search">{{ 'card.back' | transloco }}</a>
      @if (error(); as code) {
        <p role="alert" class="gr-field__error">{{ 'card.errors.' + code | transloco }}</p>
      } @else if (card(); as c) {
        <h1 class="gr-display">{{ c.name }}</h1>
        <pb-card-image [src]="image(c)" [alt]="c.name + ' ' + c.number" [eager]="true" />
        <button grButton type="button" (click)="add().openFor(c)">
          {{ 'add.open' | transloco }}
        </button>
        <dl class="gr-stack">
          <div>
            <dt class="gr-text-muted">{{ 'card.set' | transloco }}</dt>
            <dd>{{ c.setName }} · #{{ c.number }}</dd>
          </div>
          @if (c.rarity) {
            <div>
              <dt class="gr-text-muted">{{ 'card.rarity' | transloco }}</dt>
              <dd>{{ c.rarity }}</dd>
            </div>
          }
          <div>
            <dt class="gr-text-muted">{{ 'card.finishes' | transloco }}</dt>
            <dd>
              @for (f of c.finishes; track f; let last = $last) {
                {{ 'finish.' + f | transloco }}{{ last ? '' : ', ' }}
              }
            </dd>
          </div>
        </dl>
      } @else {
        <pb-spinner [label]="'search.loading' | transloco" />
      }
    </div>
    <pb-add-owned-card-dialog />
  `,
})
export class CardDetailPage {
  private readonly catalog = inject(CatalogService);
  private readonly language = inject(LanguageService);

  /** Bound from the route parameter. */
  readonly id = input.required<string>();
  protected readonly add = viewChild.required(AddOwnedCardDialog);

  protected readonly card = signal<Card | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly image = (card: Card) => cardImageUrl(card, 'high');

  constructor() {
    effect(() => {
      const id = this.id();
      const lang = toCatalogLang(this.language.current());
      this.card.set(null);
      this.error.set(null);
      this.catalog.getCard(id, lang).then(
        (card) => {
          if (id === this.id()) this.card.set(card);
        },
        (error: unknown) => {
          if (id === this.id())
            this.error.set(error instanceof CatalogError ? error.code : 'unknown');
        },
      );
    });
  }
}
