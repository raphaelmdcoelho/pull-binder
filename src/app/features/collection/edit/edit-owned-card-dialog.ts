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
import { CollectionStore } from '../../../collection/collection.store';
import {
  CONDITIONS,
  Condition,
  MAX_QUANTITY,
  OwnedCard,
} from '../../../collection/owned-card.model';
import { OwnedCardsError } from '../../../collection/owned-cards.repository';
import { QuantityStepper } from '../../../shared/ui/quantity-stepper/quantity-stepper';
import { PbSelect } from '../../../shared/ui/select/select';
import { StatusService } from '../../../shared/ui/status-region/status.service';

/** Changes the quantity and Condition of one Owned card. Language and Finish identify it, so they stay fixed. */
@Component({
  selector: 'pb-edit-owned-card-dialog',
  imports: [GR_DIALOG, GrButton, TranslocoPipe, PbSelect, QuantityStepper],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <gr-dialog size="sm" [(open)]="isOpen" [label]="'edit.title' | transloco">
      @if (isOpen()) {
        @if (card(); as c) {
          <div grDialogHeader>
            <h2 grDialogTitle>{{ 'edit.title' | transloco }}</h2>
          </div>
          <form (submit)="$event.preventDefault(); save()" novalidate>
            <div grDialogBody class="gr-stack">
              <p>
                <strong>{{ c.cardName }}</strong>
                <span class="gr-text-muted"> · {{ c.setName }} · #{{ c.cardNumber }}</span>
              </p>
              <p class="gr-text-muted">
                {{ 'language.' + c.language | transloco }} · {{ 'finish.' + c.finish | transloco }}
              </p>

              <pb-quantity-stepper
                [label]="'add.quantity' | transloco"
                [decreaseLabel]="'add.decrease' | transloco"
                [increaseLabel]="'add.increase' | transloco"
                [max]="maxQuantity"
                [(value)]="quantity"
              />

              <div class="gr-field">
                <label class="gr-field__label" for="edit-condition">{{
                  'add.condition' | transloco
                }}</label>
                <p class="gr-field__hint" id="edit-condition-hint">
                  {{ 'edit.conditionHint' | transloco }}
                </p>
                <select
                  pbSelect
                  id="edit-condition"
                  aria-describedby="edit-condition-hint"
                  (change)="condition.set($any($event.target).value)"
                >
                  @for (o of conditions; track o) {
                    <option [value]="o" [selected]="o === condition()">
                      {{ 'condition.' + o | transloco }}
                    </option>
                  }
                </select>
              </div>

              @if (!connectivity.online()) {
                <p class="gr-text-muted" role="status">{{ 'pwa.writeDisabled' | transloco }}</p>
              }
              @if (error(); as code) {
                <p role="alert" class="gr-field__error">{{ 'edit.errors.' + code | transloco }}</p>
              }
            </div>
            <div grDialogFooter>
              <button grButton variant="secondary" type="button" (click)="close()">
                {{ 'add.cancel' | transloco }}
              </button>
              <button
                grButton
                type="submit"
                [disabled]="!changed() || busy() || !connectivity.online()"
              >
                {{ (busy() ? 'edit.saving' : 'edit.save') | transloco }}
              </button>
            </div>
          </form>
        }
      }
    </gr-dialog>
  `,
})
export class EditOwnedCardDialog {
  private readonly dialog = viewChild.required(GrDialog);
  protected readonly connectivity = inject(ConnectivityService);
  private readonly store = inject(CollectionStore);
  private readonly status = inject(StatusService);
  private readonly transloco = inject(TranslocoService);

  protected readonly conditions = CONDITIONS;
  protected readonly maxQuantity = MAX_QUANTITY;

  protected readonly isOpen = signal(false);
  protected readonly card = signal<OwnedCard | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly quantity = signal(1);
  protected readonly condition = signal<Condition>('near_mint');

  protected readonly changed = computed(() => {
    const c = this.card();
    return !!c && (this.quantity() !== c.quantity || this.condition() !== c.condition);
  });

  openFor(card: OwnedCard): void {
    this.card.set(card);
    this.quantity.set(card.quantity);
    this.condition.set(card.condition);
    this.error.set(null);
    this.busy.set(false);
    this.isOpen.set(true);
  }

  protected close(): void {
    this.dialog().close('cancel');
  }

  protected async save(): Promise<void> {
    const card = this.card();
    if (!card || this.busy() || !this.changed()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const result = await this.store.update(card, {
        quantity: this.quantity(),
        condition: this.condition(),
      });
      const key = result.merged ? 'edit.merged' : 'edit.saved';
      this.status.announce(
        this.transloco.translate(key, { name: card.cardName, total: result.card.quantity }),
      );
      this.dialog().close('saved');
    } catch (error) {
      this.error.set(error instanceof OwnedCardsError ? error.code : 'unknown');
    } finally {
      this.busy.set(false);
    }
  }
}
