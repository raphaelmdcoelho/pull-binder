import { ConnectivityService } from '../../../core/pwa/connectivity.service';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { GR_DIALOG, GrButton, GrDialog } from '@grass-ds/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Card, Finish } from '../../../catalog/card.model';
import { CatalogService, toCatalogLang } from '../../../catalog/catalog.service';
import { CollectionStore } from '../../../collection/collection.store';
import {
  CARD_LANGUAGES,
  CONDITIONS,
  CardLanguage,
  Condition,
  MAX_QUANTITY,
  isCardLanguage,
} from '../../../collection/owned-card.model';
import { OwnedCardsError, OwnedCardsRepository } from '../../../collection/owned-cards.repository';
import { LanguageService } from '../../../core/i18n/language.service';
import { QuantityStepper } from '../../../shared/ui/quantity-stepper/quantity-stepper';
import { PbSelect } from '../../../shared/ui/select/select';
import { Spinner } from '../../../shared/ui/spinner/spinner';
import { StatusService } from '../../../shared/ui/status-region/status.service';

type Phase = 'loading' | 'ready' | 'load-error';

/**
 * "Add to collection" dialog. Host it once per page and call `openFor(card | cardId)`. A card id is
 * resolved through the Catalog first (the search grid only knows summaries).
 */
@Component({
  selector: 'pb-add-owned-card-dialog',
  imports: [GR_DIALOG, GrButton, TranslocoPipe, PbSelect, QuantityStepper, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <gr-dialog size="sm" [(open)]="isOpen" [label]="'add.title' | transloco">
      @if (isOpen()) {
        <div grDialogHeader>
          <h2 grDialogTitle>{{ 'add.title' | transloco }}</h2>
        </div>
        <form (submit)="$event.preventDefault(); submit()" novalidate>
          <div grDialogBody class="gr-stack">
            @switch (phase()) {
              @case ('loading') {
                <pb-spinner [label]="'search.loading' | transloco" />
              }
              @case ('load-error') {
                <p role="alert" class="gr-field__error">
                  {{ 'card.errors.' + loadError() | transloco }}
                </p>
              }
              @default {
                @if (card(); as c) {
                  <p>
                    <strong>{{ c.name }}</strong>
                    <span class="gr-text-muted"> · {{ c.setName }} · #{{ c.number }}</span>
                  </p>

                  <pb-quantity-stepper
                    [label]="'add.quantity' | transloco"
                    [decreaseLabel]="'add.decrease' | transloco"
                    [increaseLabel]="'add.increase' | transloco"
                    [max]="maxQuantity"
                    [(value)]="quantity"
                  />

                  <div class="gr-field">
                    <label class="gr-field__label" for="add-condition">{{
                      'add.condition' | transloco
                    }}</label>
                    <select
                      pbSelect
                      id="add-condition"
                      (change)="condition.set($any($event.target).value)"
                    >
                      @for (c of conditions; track c) {
                        <option [value]="c" [selected]="c === condition()">
                          {{ 'condition.' + c | transloco }}
                        </option>
                      }
                    </select>
                  </div>

                  <div class="gr-field">
                    <label class="gr-field__label" for="add-language">{{
                      'add.language' | transloco
                    }}</label>
                    <p class="gr-field__hint" id="add-language-hint">
                      {{ 'add.languageHint' | transloco }}
                    </p>
                    <select
                      pbSelect
                      id="add-language"
                      aria-describedby="add-language-hint"
                      (change)="language.set($any($event.target).value)"
                    >
                      @for (l of languages; track l) {
                        <option [value]="l" [selected]="l === language()">
                          {{ 'language.' + l | transloco }}
                        </option>
                      }
                    </select>
                  </div>

                  <div class="gr-field">
                    <label class="gr-field__label" for="add-finish">{{
                      'add.finish' | transloco
                    }}</label>
                    <select
                      pbSelect
                      id="add-finish"
                      (change)="finish.set($any($event.target).value)"
                    >
                      @for (f of c.finishes; track f) {
                        <option [value]="f" [selected]="f === finish()">
                          {{ 'finish.' + f | transloco }}
                        </option>
                      }
                    </select>
                  </div>

                  @if (!connectivity.online()) {
                    <p class="gr-text-muted" role="status">{{ 'pwa.writeDisabled' | transloco }}</p>
                  }
                  @if (error(); as code) {
                    <p role="alert" class="gr-field__error">
                      {{ 'add.errors.' + code | transloco }}
                    </p>
                  }
                }
              }
            }
          </div>
          <div grDialogFooter>
            <button grButton variant="secondary" type="button" (click)="close()">
              {{ 'add.cancel' | transloco }}
            </button>
            <button
              grButton
              type="submit"
              [disabled]="phase() !== 'ready' || busy() || !connectivity.online()"
            >
              {{ (busy() ? 'add.adding' : 'add.submit') | transloco }}
            </button>
          </div>
        </form>
      }
    </gr-dialog>
  `,
})
export class AddOwnedCardDialog {
  private readonly dialog = viewChild.required(GrDialog);
  protected readonly connectivity = inject(ConnectivityService);
  private readonly catalog = inject(CatalogService);
  private readonly repository = inject(OwnedCardsRepository);
  private readonly collection = inject(CollectionStore);
  private readonly language$ = inject(LanguageService);
  private readonly status = inject(StatusService);
  private readonly transloco = inject(TranslocoService);

  protected readonly conditions = CONDITIONS;
  protected readonly languages = CARD_LANGUAGES;
  protected readonly maxQuantity = MAX_QUANTITY;

  protected readonly isOpen = signal(false);
  protected readonly phase = signal<Phase>('loading');
  protected readonly card = signal<Card | null>(null);
  protected readonly loadError = signal('unknown');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly quantity = signal(1);
  protected readonly condition = signal<Condition>('near_mint');
  protected readonly language = signal<CardLanguage>('en');
  protected readonly finish = signal<Finish>('normal');
  protected readonly valid = computed(
    () => this.quantity() >= 1 && this.quantity() <= MAX_QUANTITY,
  );

  private openId = 0;

  /** Opens the dialog for a loaded Card, or for a card id that is fetched first. */
  openFor(target: Card | string): void {
    const id = ++this.openId;
    this.reset();
    this.isOpen.set(true);
    if (typeof target !== 'string') {
      this.setCard(target);
      return;
    }
    this.phase.set('loading');
    this.catalog.getCard(target, toCatalogLang(this.language$.current())).then(
      (card) => id === this.openId && this.setCard(card),
      (error: unknown) => {
        if (id !== this.openId) return;
        this.loadError.set(
          error instanceof Error && 'code' in error ? String(error.code) : 'unknown',
        );
        this.phase.set('load-error');
      },
    );
  }

  protected close(): void {
    this.dialog().close('cancel');
  }

  protected async submit(): Promise<void> {
    const card = this.card();
    if (!card || this.busy()) return;
    if (!this.valid()) return void this.error.set('quantity-limit');
    if (!this.connectivity.online()) return void this.error.set('offline');
    this.busy.set(true);
    this.error.set(null);
    try {
      const owned = await this.repository.add({
        card,
        language: this.language(),
        condition: this.condition(),
        finish: this.finish(),
        quantity: this.quantity(),
      });
      this.collection.markStale();
      this.status.announce(
        this.transloco.translate('add.added', {
          count: this.quantity(),
          name: card.name,
          total: owned.quantity,
        }),
      );
      this.dialog().close('added');
    } catch (error) {
      this.error.set(error instanceof OwnedCardsError ? error.code : 'unknown');
    } finally {
      this.busy.set(false);
    }
  }

  private setCard(card: Card): void {
    this.card.set(card);
    this.language.set(isCardLanguage(card.lang) ? card.lang : 'en');
    this.finish.set(card.finishes[0] ?? 'normal');
    this.phase.set('ready');
  }

  private reset(): void {
    this.card.set(null);
    this.error.set(null);
    this.busy.set(false);
    this.quantity.set(1);
    this.condition.set('near_mint');
  }
}
