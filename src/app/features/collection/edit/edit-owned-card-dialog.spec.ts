import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OwnedCard } from '../../../collection/owned-card.model';
import { OwnedCardsError } from '../../../collection/owned-cards.repository';
import { CollectionStore } from '../../../collection/collection.store';
import { LanguageService } from '../../../core/i18n/language.service';
import { polyfillDialog } from '../../../../testing/dialog-polyfill';
import {
  FakeOwnedCards,
  ownedCard,
  provideFakeOwnedCards,
} from '../../../../testing/fake-owned-cards';
import { provideTestI18n } from '../../../../testing/transloco';
import { StatusService } from '../../../shared/ui/status-region/status.service';
import { EditOwnedCardDialog } from './edit-owned-card-dialog';

@Component({ imports: [EditOwnedCardDialog], template: `<pb-edit-owned-card-dialog />` })
class Host {
  readonly dialog = viewChild.required(EditOwnedCardDialog);
}

async function setup(rows: OwnedCard[]) {
  localStorage.clear();
  polyfillDialog();
  const fake = new FakeOwnedCards();
  fake.rows = rows;
  TestBed.configureTestingModule({
    imports: [Host],
    providers: [provideTestI18n(), provideFakeOwnedCards(fake)],
  });
  await TestBed.inject(LanguageService).set('en');
  const store = TestBed.inject(CollectionStore);
  await store.reload();
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const open = async (card: OwnedCard) => {
    fixture.componentInstance.dialog().openFor(card);
    await settle();
  };
  const save = () => el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const submit = async () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
  };
  return { fake, store, el, settle, open, save, submit };
}

describe('EditOwnedCardDialog', () => {
  it('starts with the current values and cannot save until something changes', async () => {
    const card = ownedCard({ id: '1', quantity: 3, condition: 'lightly_played' });
    const { el, open, save } = await setup([card]);
    await open(card);
    expect(el.querySelector<HTMLInputElement>('input[type="number"]')!.value).toBe('3');
    expect(el.querySelector<HTMLSelectElement>('#edit-condition')!.value).toBe('lightly_played');
    expect(save().disabled).toBe(true);
  });

  it('saves a new quantity, announces it and updates the list', async () => {
    const card = ownedCard({ id: '1', quantity: 1 });
    const { store, el, open, save, submit, settle } = await setup([card]);
    await open(store.cards()[0]);
    el.querySelector<HTMLButtonElement>('[aria-label="One more"]')!.click();
    await settle();
    expect(save().disabled).toBe(false);
    await submit();
    expect(store.cards()[0].quantity).toBe(2);
    expect(TestBed.inject(StatusService).message()?.text).toBe(
      'Updated Charizard. You now have 2.',
    );
    expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(false);
  });

  it('says when the new condition was combined with an existing Owned card', async () => {
    const nm = ownedCard({ id: '1', condition: 'near_mint', quantity: 2 });
    const dm = ownedCard({ id: '2', condition: 'damaged', quantity: 3 });
    const { store, el, open, submit, settle } = await setup([nm, dm]);
    await open(store.cards().find((c) => c.id === '2')!);
    const select = el.querySelector<HTMLSelectElement>('#edit-condition')!;
    select.value = 'near_mint';
    select.dispatchEvent(new Event('change'));
    await settle();
    await submit();
    expect(TestBed.inject(StatusService).message()?.text).toContain(
      'Combined with your existing Charizard. You now have 5.',
    );
    expect(store.cards()).toHaveLength(1);
  });

  it('keeps the dialog open with an alert when saving fails', async () => {
    const card = ownedCard({ id: '1' });
    const { fake, store, el, open, submit, settle } = await setup([card]);
    fake.updateImpl = async () => {
      throw new OwnedCardsError('quantity-limit');
    };
    await open(store.cards()[0]);
    el.querySelector<HTMLButtonElement>('[aria-label="One more"]')!.click();
    await settle();
    await submit();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('at most 9999');
    expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(true);
  });
});
