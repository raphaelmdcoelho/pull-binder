import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { GR_DIALOG, GrButton, GrDialog } from '@grass-ds/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CollectionStore } from '../../../collection/collection.store';
import { OwnedCard } from '../../../collection/owned-card.model';
import { OwnedCardsError } from '../../../collection/owned-cards.repository';
import { StatusService } from '../../../shared/ui/status-region/status.service';

/**
 * Asks before removing an Owned card. Removing is permanent (there is no undo), so the dialog says
 * how many copies go and Cancel has the initial focus.
 */
@Component({
  selector: 'pb-remove-owned-card-dialog',
  imports: [GR_DIALOG, GrButton, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <gr-dialog size="sm" [(open)]="isOpen" [label]="'remove.title' | transloco">
      @if (isOpen()) {
        @if (card(); as c) {
          <div grDialogHeader>
            <h2 grDialogTitle>{{ 'remove.title' | transloco }}</h2>
          </div>
          <form (submit)="$event.preventDefault(); confirm()" novalidate>
            <div grDialogBody class="gr-stack">
              <p>{{ 'remove.body' | transloco: { name: c.cardName, count: c.quantity } }}</p>
              <p class="gr-text-muted">
                {{ 'condition.' + c.condition | transloco }} ·
                {{ 'language.' + c.language | transloco }} ·
                {{ 'finish.' + c.finish | transloco }}
              </p>
              <p class="gr-text-muted">{{ 'remove.permanent' | transloco }}</p>
              @if (error(); as code) {
                <p role="alert" class="gr-field__error">{{ 'edit.errors.' + code | transloco }}</p>
              }
            </div>
            <div grDialogFooter>
              <!-- Focus Cancel first in a destructive confirmation (grass-ds Dialog guidance). -->
              <!-- eslint-disable-next-line @angular-eslint/template/no-autofocus -->
              <button grButton variant="secondary" type="button" autofocus (click)="close()">
                {{ 'remove.cancel' | transloco }}
              </button>
              <button grButton variant="danger" type="submit" [disabled]="busy()">
                {{ (busy() ? 'remove.removing' : 'remove.confirm') | transloco }}
              </button>
            </div>
          </form>
        }
      }
    </gr-dialog>
  `,
})
export class RemoveOwnedCardDialog {
  private readonly dialog = viewChild.required(GrDialog);
  private readonly store = inject(CollectionStore);
  private readonly status = inject(StatusService);
  private readonly transloco = inject(TranslocoService);

  protected readonly isOpen = signal(false);
  protected readonly card = signal<OwnedCard | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  openFor(card: OwnedCard): void {
    this.card.set(card);
    this.error.set(null);
    this.busy.set(false);
    this.isOpen.set(true);
  }

  protected close(): void {
    this.dialog().close('cancel');
  }

  protected async confirm(): Promise<void> {
    const card = this.card();
    if (!card || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.store.remove(card);
      this.status.announce(
        this.transloco.translate('remove.removed', { name: card.cardName, count: card.quantity }),
      );
      this.dialog().close('removed');
    } catch (error) {
      this.error.set(error instanceof OwnedCardsError ? error.code : 'unknown');
    } finally {
      this.busy.set(false);
    }
  }
}
